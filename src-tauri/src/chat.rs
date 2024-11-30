use crate::database::{Chat, Message};
use crate::DB;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, Window};
use tokio::sync::{Mutex, broadcast};

// Message Types and Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: Option<String>,
    pub role: String,
    pub content: String,
    pub is_pinned: Option<bool>,
    pub system_prompt_type: Option<String>,
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
    pub system: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
    pub follow_ups: Option<Vec<FollowUpSuggestion>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamResponse {
    pub content: String,
    pub done: bool,
    pub chat_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FollowUpSuggestion {
    pub text: String,
    pub type_: String, // "web" or "context"
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
    context_window: usize,
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
    id: Option<String>,
    pub role: String,
    pub content: String,
    pub created_at: Option<String>,
    pub is_pinned: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelConfig {
    pub name: String,
    pub context_window: usize,
    pub max_output_tokens: i32,
}

impl ModelConfig {
    pub fn get_default_config(model: &str) -> Self {
        match model {
            "gemma:2b" => Self {
                name: model.to_string(),
                context_window: 8192,
                max_output_tokens: 2048,
            },
            "gemma:7b" => Self {
                name: model.to_string(),
                context_window: 8192,
                max_output_tokens: 2048,
            },
            "llama2" => Self {
                name: model.to_string(),
                context_window: 4096,
                max_output_tokens: 2048,
            },
            _ => Self {
                name: model.to_string(),
                context_window: 4096, // Default conservative context window
                max_output_tokens: 2048,
            },
        }
    }
}

// Context Management Implementation
impl ChatContext {
    pub async fn new(model: &str) -> Result<Self, String> {
        let model_details = ModelConfig::get_default_config(model);
        
        Ok(Self {
            messages: Vec::new(),
            total_tokens: 0,
            context_window: model_details.context_window,
            pruned_count: 0,
        })
    }

    pub fn get_stats(&self) -> ContextStats {
        ContextStats {
            total_tokens: self.total_tokens,
            max_tokens: self.context_window,
            message_count: self.messages.len(),
            context_percentage: (self.total_tokens as f32 / self.context_window as f32) * 100.0,
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
        while self.total_tokens > self.context_window && self.messages.len() > 1 {
            // Find the last non-pinned message before the most recent message
            if let Some(idx) = self.messages[..self.messages.len()-1]
                .iter()
                .rposition(|m| !m.is_pinned.unwrap_or(false)) 
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

// Generate follow-up suggestions based on the conversation context
pub async fn generate_follow_ups(messages: &[ChatMessage], current_response: &str) -> Result<Vec<FollowUpSuggestion>, String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/generate";

    let prompt = format!(
        "Based on this conversation, generate 3 natural follow-up questions. Each question should be on a new line and end with a question mark. Questions should be concise and help explore the topic further.\n\nResponse to analyze: {}\n\nQuestions:",
        current_response
    );
    
    println!("Generating follow-ups for response: {}", current_response);
    
    let request = serde_json::json!({
        "model": "gemma2:9b",
        "prompt": prompt,
        "stream": false,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
            "top_k": 40,
            "repeat_penalty": 1.1,
            "num_predict": 150,
        }
    });

    let response = client
        .post(url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to get response text: {}", e))?;
    
    println!("Raw Ollama response: {}", response_text);

    // Parse Ollama's response format
    let ollama_response: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
    
    // Extract the response text from Ollama's format
    let response_content = ollama_response["response"]
        .as_str()
        .ok_or("Failed to get response content")?;

    println!("Extracted response content: {}", response_content);

    // Extract questions from the response, ensuring they end with question marks
    let questions: Vec<String> = response_content
        .lines()
        .filter(|line| line.trim().ends_with("?"))
        .take(3)
        .map(|s| s.trim().to_string())
        .collect();

    println!("Extracted questions: {:?}", questions);

    if questions.is_empty() {
        println!("No valid questions found in response");
        return Ok(vec![]);
    }

    // Convert questions to FollowUpSuggestions
    let suggestions = questions
        .into_iter()
        .map(|text| FollowUpSuggestion {
            text,
            type_: "context".to_string(),
        })
        .collect::<Vec<_>>();

    println!("Generated {} follow-up suggestions", suggestions.len());
    Ok(suggestions)
}

// Tauri Commands
#[derive(Clone)]
pub struct ChatState {
    cancel_tx: broadcast::Sender<()>,
}

impl Default for ChatState {
    fn default() -> Self {
        let (tx, _) = broadcast::channel(1);
        Self { cancel_tx: tx }
    }
}

impl ChatState {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn reset_cancellation(&self) -> broadcast::Receiver<()> {
        self.cancel_tx.subscribe()
    }

    pub fn cancel_generation(&self) {
        let _ = self.cancel_tx.send(());
    }
}

#[tauri::command]
pub async fn cancel_chat_generation<'a>(state: tauri::State<'a, ChatState>) -> Result<(), String> {
    state.cancel_generation();
    Ok(())
}

#[tauri::command]
pub async fn get_context_stats(chat_id: String) -> Result<ContextStats, String> {
    // Get messages first, releasing the lock immediately
    let messages = {
        let db_guard = DB.lock().unwrap();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        db.get_chat_messages(&chat_id)
            .map_err(|e| format!("Failed to get chat messages: {}", e))?
    };

    // Now create context and add messages after DB lock is released
    let mut context = ChatContext::new("gemma:2b").await?;
    for msg in messages {
        context.add_message(ChatMessage {
            id: Some(msg.id),
            role: msg.role,
            content: msg.content,
            is_pinned: Some(msg.is_pinned),
            system_prompt_type: msg.system_prompt_type,
        });
    }

    Ok(context.get_stats())
}

#[tauri::command]
pub async fn chat(
    window: Window,
    state: tauri::State<'_, ChatState>,
    model: String,
    mut messages: Vec<ChatMessage>,
    params: ModelParams,
    chat_id: Option<String>,
    system_prompt: Option<String>,
    system_prompt_type: Option<String>,
    instance_id: String,
) -> Result<(), String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/chat";
    let mut cancel_rx = state.reset_cancellation();

    // Initialize context manager
    let mut context = ChatContext::new(&model).await?;

    // Add system prompt if provided
    if let Some(system) = &system_prompt {
        context.add_message(ChatMessage {
            id: None,
            role: "system".to_string(),
            content: system.clone(),
            is_pinned: Some(false),
            system_prompt_type: None,
        });
    }

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
                is_pinned: Some(msg.is_pinned),
                system_prompt_type: msg.system_prompt_type,
            });
        }
    }

    // Add the new message to context and emit stats
    if let Some(new_message) = messages.last().cloned() {
        let stats = context.add_message(new_message);
        window
            .emit(&format!("context-update-{}", instance_id), &stats)
            .map_err(|e| format!("Failed to emit context stats: {}", e))?;
    }

    let payload = ChatRequest {
        model,
        messages: context.get_messages().clone(),
        stream: true,
        params,
        system: system_prompt,
    };

    // Save user's message if chat_id is provided
    if let Some(chat_id) = &chat_id {
        if let Some(last_message) = messages.last() {
            if last_message.role == "user" {
                let mut db_guard = DB.lock().unwrap();
                let db = db_guard.as_mut().ok_or("Database not initialized")?;
                db.add_message(
                    chat_id,
                    &last_message.role,
                    &last_message.content,
                    last_message.is_pinned.unwrap_or(false),
                    last_message.system_prompt_type.clone(),
                )
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

    loop {
        tokio::select! {
            chunk_result = stream.next() => {
                match chunk_result {
                    Some(Ok(chunk)) => {
                        buffer.extend_from_slice(&chunk);

                        if let Ok(text) = String::from_utf8(buffer.clone()) {
                            if let Ok(chat_response) = serde_json::from_str::<ChatResponse>(&text) {
                                current_response.push_str(&chat_response.message.content);

                                // Emit streaming response with instance-specific event
                                window
                                    .emit(
                                        &format!("chat-response-{}", instance_id),
                                        ChatResponse {
                                            message: ChatMessage {
                                                id: None,
                                                role: "assistant".to_string(),
                                                content: chat_response.message.content,
                                                is_pinned: Some(false),
                                                system_prompt_type: None,
                                            },
                                            done: false,
                                            follow_ups: None,
                                        },
                                    )
                                    .map_err(|e| format!("Failed to emit response: {}", e))?;

                                if chat_response.done {
                                    // Generate follow-up suggestions
                                    let follow_ups = generate_follow_ups(context.get_messages(), &current_response).await?;

                                    // Update context with assistant's response
                                    let stats = context.add_message(ChatMessage {
                                        id: None,
                                        role: "assistant".to_string(),
                                        content: current_response.clone(),
                                        is_pinned: Some(false),
                                        system_prompt_type: None,
                                    });

                                    // Emit final context stats with instance-specific event
                                    window
                                        .emit(&format!("context-update-{}", instance_id), &stats)
                                        .map_err(|e| format!("Failed to emit context stats: {}", e))?;

                                    // Save message if chat_id exists
                                    if let Some(chat_id) = &chat_id {
                                        let mut db_guard = DB.lock().unwrap();
                                        let db = db_guard.as_mut().ok_or("Database not initialized")?;

                                        db.add_message(
                                            chat_id,
                                            "assistant",
                                            &current_response,
                                            false,
                                            system_prompt_type.clone(),
                                        )
                                        .map_err(|e| format!("Failed to save assistant response: {}", e))?;
                                    }

                                    // Emit completion with follow-ups using instance-specific event
                                    window
                                        .emit(
                                            &format!("chat-complete-{}", instance_id),
                                            ChatResponse {
                                                message: ChatMessage {
                                                    id: None,
                                                    role: "assistant".to_string(),
                                                    content: current_response.clone(),
                                                    is_pinned: Some(false),
                                                    system_prompt_type: None,
                                                },
                                                done: true,
                                                follow_ups: Some(follow_ups),
                                            },
                                        )
                                        .map_err(|e| format!("Failed to emit completion: {}", e))?;
                                }

                                buffer.clear();
                            }
                        }
                        buffer.clear();
                    }
                    Some(Err(e)) => return Err(format!("Failed to read response chunk: {}", e)),
                    None => break,
                }
            }
            _ = cancel_rx.recv() => {
                // Emit cancellation event with instance-specific event
                window.emit(&format!("chat-cancelled-{}", instance_id), ())
                    .map_err(|e| format!("Failed to emit cancellation event: {}", e))?;
                return Ok(());
            }
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
    system_prompt_type: Option<String>,
) -> Result<(), String> {
    let mut db_guard = DB.lock().unwrap();
    let db = db_guard.as_mut().ok_or("Database not initialized")?;

    db.add_message(
        &chat_id,
        &role,
        &content,
        is_pinned.unwrap_or(false),
        system_prompt_type,
    )
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
            is_pinned: Some(m.is_pinned),
            system_prompt_type: m.system_prompt_type,
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
                    id: Some(m.id),
                    role: m.role,
                    content: m.content,
                    created_at: Some(m.created_at.to_rfc3339()),
                    is_pinned: m.is_pinned,
                })
                .collect(),
        },
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize chat: {}", e))
}

#[tauri::command]
pub async fn import_chat(file_path: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let chat_export: ChatExport = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse chat data: {}", e))?;
    
    let mut db_guard = DB.lock()
        .map_err(|_| "Failed to lock database")?;
    let db = db_guard
        .as_mut()
        .ok_or("Database not initialized")?;
    
    // Create new chat and get the ID from the database
    let chat = db.create_chat(&chat_export.chat.title, &chat_export.chat.model)
        .map_err(|e| format!("Failed to create chat: {}", e))?;
    
    // Import messages using the chat ID from the database
    for msg in chat_export.chat.messages {
        db.add_message(&chat.id, &msg.role, &msg.content, msg.is_pinned, None)
            .map_err(|e| format!("Failed to create message: {}", e))?;
    }
    
    Ok(chat.id)
}
