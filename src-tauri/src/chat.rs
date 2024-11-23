use crate::database::{Chat, Message};
use crate::DB;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, Window};
use tokio::sync::Mutex as AsyncMutex;

// Message Types and Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: Option<String>,
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub is_pinned: bool,
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

// Context Management Structures
#[derive(Debug, Serialize)]
pub struct ContextStats {
    pub total_tokens: usize,
    pub max_tokens: usize,
    pub message_count: usize,
    pub context_percentage: f32,
    pub pruned_messages: usize,
}

#[derive(Debug)]
pub struct ChatContext {
    messages: Vec<ChatMessage>,
    total_tokens: usize,
    max_tokens: usize,
    pruned_count: usize,
}

// Export Related Structures
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

// Context Management Implementation
impl ChatContext {
    pub fn new(max_tokens: usize) -> Self {
        Self {
            messages: Vec::new(),
            total_tokens: 0,
            max_tokens,
            pruned_count: 0,
        }
    }

    pub fn get_stats(&self) -> ContextStats {
        ContextStats {
            total_tokens: self.total_tokens,
            max_tokens: self.max_tokens,
            message_count: self.messages.len(),
            context_percentage: (self.total_tokens as f32 / self.max_tokens as f32) * 100.0,
            pruned_messages: self.pruned_count,
        }
    }

    fn estimate_tokens(content: &str) -> usize {
        // Enhanced token estimation
        // Average token is about 4 characters
        let char_count = content.chars().count();
        let whitespace_count = content.chars().filter(|c| c.is_whitespace()).count();
        let special_chars = content.chars().filter(|c| !c.is_alphanumeric()).count();

        // Base calculation considering different character types
        (char_count + whitespace_count + special_chars * 2 + 3) / 4
    }

    pub fn add_message(&mut self, message: ChatMessage) -> ContextStats {
        let estimated_tokens = Self::estimate_tokens(&message.content);

        // Add new message
        self.messages.push(message);
        self.total_tokens += estimated_tokens;

        // Prune messages if we exceed the token limit
        while self.total_tokens > self.max_tokens && self.messages.len() > 1 {
            // Find the last non-pinned message before the most recent message
            if let Some(idx) = self.messages[..self.messages.len()-1]
                .iter()
                .rposition(|m| !m.is_pinned) 
            {
                let removed_message = self.messages.remove(idx);
                let removed_tokens = Self::estimate_tokens(&removed_message.content);
                self.total_tokens = self.total_tokens.saturating_sub(removed_tokens);
                self.pruned_count += 1;
            } else {
                // If all messages except the last one are pinned, we need to keep them
                break;
            }
        }

        self.get_stats()
    }

    pub fn get_messages(&self) -> &Vec<ChatMessage> {
        &self.messages
    }
}

// Tauri Commands
#[tauri::command]
pub async fn get_context_stats(chat_id: String) -> Result<ContextStats, String> {
    let db_guard = DB.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let messages = db
        .get_chat_messages(&chat_id)
        .map_err(|e| format!("Failed to get chat messages: {}", e))?;

    let mut context = ChatContext::new(2048); // We'll make this configurable later
    for msg in messages {
        context.add_message(ChatMessage {
            id: Some(msg.id),
            role: msg.role,
            content: msg.content,
            is_pinned: msg.is_pinned,
        });
    }

    Ok(context.get_stats())
}

#[tauri::command]
pub async fn chat(
    window: Window,
    model: String,
    mut messages: Vec<ChatMessage>,
    params: ModelParams,
    chat_id: Option<String>,
) -> Result<(), String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/chat";

    // Initialize context manager
    let mut context = ChatContext::new(params.max_tokens as usize);

    // Load existing conversation if chat_id exists
    if let Some(chat_id) = &chat_id {
        let db_guard = DB.lock().unwrap();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        let history = db
            .get_chat_messages(chat_id)
            .map_err(|e| format!("Failed to get chat history: {}", e))?;

        // Add all messages, preserving their pinned state and IDs
        for msg in history {
            context.add_message(ChatMessage {
                id: Some(msg.id),
                role: msg.role,
                content: msg.content,
                is_pinned: msg.is_pinned,
            });
        }
    }

    // Add the new message to context and emit stats
    if let Some(new_message) = messages.last().cloned() {
        let stats = context.add_message(new_message);
        window
            .emit("context-update", &stats)
            .map_err(|e| format!("Failed to emit context stats: {}", e))?;
    }

    let payload = ChatRequest {
        model,
        messages: context.get_messages().clone(),
        stream: true,
        params,
    };

    // Save user's message if chat_id is provided
    if let Some(chat_id) = &chat_id {
        if let Some(last_message) = messages.last() {
            if last_message.role == "user" {
                let mut db_guard = DB.lock().unwrap();
                let db = db_guard.as_mut().ok_or("Database not initialized")?;
                db.add_message(chat_id, &last_message.role, &last_message.content, last_message.is_pinned)
                    .map_err(|e| format!("Failed to save user message: {}", e))?;
            }
        }
    }

    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

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

                        window
                            .emit("chat-response", &chat_response)
                            .map_err(|e| format!("Failed to emit response: {}", e))?;

                        if chat_response.done {
                            if let Some(chat_id) = &chat_id {
                                let mut db_guard = DB.lock().unwrap();
                                let db = db_guard.as_mut().ok_or("Database not initialized")?;

                                db.add_message(chat_id, "assistant", &current_response, false)
                                    .map_err(|e| {
                                        format!("Failed to save assistant response: {}", e)
                                    })?;
                            }

                            // Update context with assistant's response
                            let stats = context.add_message(ChatMessage {
                                id: None,
                                role: "assistant".to_string(),
                                content: current_response.clone(),
                                is_pinned: false,
                            });

                            // Emit final context stats
                            window
                                .emit("context-update", &stats)
                                .map_err(|e| format!("Failed to emit context stats: {}", e))?;

                            // Emit completion
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
pub async fn save_message(
    chat_id: String,
    content: String,
    role: String,
    is_pinned: Option<bool>,
) -> Result<(), String> {
    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    db.add_message(&chat_id, &role, &content, is_pinned.unwrap_or(false))
        .map(|_| ())
        .map_err(|e| format!("Failed to save message: {}", e))
}

#[tauri::command]
pub async fn toggle_message_pin(message_id: String) -> Result<(), String> {
    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    db.toggle_message_pin(&message_id)
        .map_err(|e| format!("Failed to toggle message pin: {}", e))
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
        .map(|m| ChatMessage {
            id: Some(m.id),
            role: m.role,
            content: m.content,
            is_pinned: m.is_pinned,
        })
        .collect())
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
    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    db.delete_chat(&chat_id)
        .map_err(|e| format!("Failed to delete chat: {}", e))
}

#[tauri::command]
pub async fn export_chat(chat_id: String) -> Result<String, String> {
    let db_guard = DB.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let chats = db
        .get_chats()
        .map_err(|e| format!("Failed to get chats: {}", e))?;

    let chat = chats
        .into_iter()
        .find(|c| c.id == chat_id)
        .ok_or_else(|| "Chat not found".to_string())?;

    let messages = db
        .get_chat_messages(&chat_id)
        .map_err(|e| format!("Failed to get messages: {}", e))?;

    let export_data = ChatExport {
        version: "1.0".to_string(),
        chat: ChatExportData {
            id: chat.id.clone(),
            title: chat.title,
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

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize chat: {}", e))
}
