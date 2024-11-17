use crate::database::Chat;
use crate::DB;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Runtime;
use tauri::{Emitter, Window};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelParams {
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: i32,
    pub repeat_penalty: f32,
    pub max_tokens: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    #[serde(flatten)]
    pub params: ModelParams,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamResponse {
    pub content: String,
    pub done: bool,
    pub chat_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatExport {
    version: String,
    chat: ChatExportData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatExportData {
    id: String,
    title: String,
    model: String,
    created_at: String,
    updated_at: String,
    messages: Vec<MessageExport>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageExport {
    id: String,
    role: String,
    content: String,
    created_at: String,
}

#[tauri::command]
pub async fn save_message(chat_id: String, content: String, role: String) -> Result<(), String> {
    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    db.add_message(&chat_id, &role, &content)
        .map(|_| ())
        .map_err(|e| format!("Failed to save message: {}", e))
}

#[tauri::command]
pub async fn get_chat_messages(chat_id: String) -> Result<Vec<ChatMessage>, String> {
    let db_guard = DB.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let messages = db
        .get_chat_messages(&chat_id)
        .map_err(|e| format!("Failed to get chat messages: {}", e))?;

    Ok(messages
        .into_iter()
        .map(|msg| ChatMessage {
            role: msg.role,
            content: msg.content,
        })
        .collect())
}

#[tauri::command]
pub async fn chat(
    window: Window,
    model: String,
    messages: Vec<ChatMessage>,
    params: ModelParams,
    chat_id: Option<String>,
) -> Result<(), String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/chat";

    let payload = ChatRequest {
        model,
        messages: messages.clone(),
        stream: true,
        params,
    };

    // Save user's message if chat_id is provided
    if let Some(chat_id) = &chat_id {
        if let Some(last_message) = messages.last() {
            if last_message.role == "user" {
                let mut db_guard = DB.lock().unwrap();
                let db = db_guard.as_mut().ok_or("Database not initialized")?;
                db.add_message(chat_id, &last_message.role, &last_message.content)
                    .map_err(|e| format!("Failed to save user message: {}", e))?;
            }
        }
    }

    let response = match client.post(url).json(&payload).send().await {
        Ok(res) => res,
        Err(e) => return Err(format!("Failed to connect to Ollama: {}", e)),
    };

    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();
    let mut current_response = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                buffer.extend_from_slice(&chunk);
                if let Ok(text) = String::from_utf8(buffer.clone()) {
                    if let Ok(chat_response) = serde_json::from_str::<ChatResponse>(&text) {
                        current_response.push_str(&chat_response.message.content);

                        // Emit response using the Emitter trait
                        window
                            .emit("chat-response", &chat_response)
                            .map_err(|e| format!("Failed to emit response: {}", e))?;

                        if chat_response.done && chat_id.is_some() {
                            let mut db_guard = DB.lock().unwrap();
                            let db = db_guard.as_mut().ok_or("Database not initialized")?;
                            db.add_message(
                                chat_id.as_ref().unwrap(),
                                "assistant",
                                &current_response,
                            )
                            .map_err(|e| format!("Failed to save assistant response: {}", e))?;

                            // Emit completion using the Emitter trait
                            let stream_response = StreamResponse {
                                content: current_response.clone(),
                                done: true,
                                chat_id: chat_id.clone(),
                            };
                            window
                                .emit("chat-complete", &stream_response)
                                .map_err(|e| format!("Failed to emit completion: {}", e))?;
                        }

                        buffer.clear();
                    }
                }
            }
            Err(e) => return Err(format!("Failed to read response chunk: {}", e)),
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_chats() -> Result<Vec<Chat>, String> {
    let db_guard = DB.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_chats()
        .map_err(|e| format!("Failed to get chats: {}", e))
}

#[tauri::command]
pub async fn create_chat(title: String, model: String) -> Result<Chat, String> {
    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    db.create_chat(&title, &model)
        .map_err(|e| format!("Failed to create chat: {}", e))
}

#[tauri::command]
pub async fn delete_chat(chat_id: String) -> Result<(), String> {
    println!("Delete chat command received for chat ID: {}", chat_id);

    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    match db.delete_chat(&chat_id) {
        Ok(_) => {
            println!("Successfully deleted chat {}", chat_id);
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to delete chat: {}", e);
            println!("Error: {}", error_msg);
            Err(error_msg)
        }
    }
}
// In src-tauri/src/chat.rs

#[tauri::command]
pub async fn export_chat(chatId: String) -> Result<String, String> {
    println!("Exporting chat with ID: {}", chatId); // Debug log

    // Get chat data from database
    let db_guard = DB.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // Get chat details
    let chats = db.get_chats().map_err(|e| {
        println!("Error getting chats: {:?}", e); // Debug log
        format!("Failed to get chats: {}", e)
    })?;

    let chat = chats.into_iter().find(|c| c.id == chatId).ok_or_else(|| {
        println!("Chat not found with ID: {}", chatId); // Debug log
        "Chat not found".to_string()
    })?;

    // Get messages
    let messages = db.get_chat_messages(&chatId).map_err(|e| {
        println!("Error getting messages: {:?}", e); // Debug log
        format!("Failed to get messages: {}", e)
    })?;

    println!("Found {} messages for chat", messages.len()); // Debug log

    // Create export data
    let export_data = ChatExport {
        version: "1.0".to_string(),
        chat: ChatExportData {
            id: chat.id.clone(),
            title: chat.title.clone(),
            model: chat.model,
            created_at: chat.created_at.to_rfc3339(),
            updated_at: chat.updated_at.to_rfc3339(),
            messages: messages
                .into_iter()
                .map(|m| MessageExport {
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    created_at: m.created_at.to_rfc3339(),
                })
                .collect(),
        },
    };

    // Convert to JSON with pretty printing
    match serde_json::to_string_pretty(&export_data) {
        Ok(json) => {
            println!("Successfully serialized chat data"); // Debug log
            Ok(json)
        }
        Err(e) => {
            println!("Error serializing chat data: {:?}", e); // Debug log
            Err(format!("Failed to serialize chat: {}", e))
        }
    }
}
