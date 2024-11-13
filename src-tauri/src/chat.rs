use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Window}; // This is the correct import

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub done: bool,
}

#[tauri::command]
pub async fn chat(window: Window, model: String, messages: Vec<ChatMessage>) -> Result<(), String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/chat";

    let payload = ChatRequest {
        model,
        messages,
        stream: true,
    };

    let response = match client.post(url).json(&payload).send().await {
        Ok(res) => res,
        Err(e) => return Err(format!("Failed to connect to Ollama: {}", e)),
    };

    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                buffer.extend_from_slice(&chunk);

                // Process the buffer line by line
                if let Ok(text) = String::from_utf8(buffer.clone()) {
                    // Try to parse as JSON
                    if let Ok(chat_response) = serde_json::from_str::<ChatResponse>(&text) {
                        // Now we can use emit() with the Emitter trait in scope
                        window
                            .emit("chat-response", &chat_response)
                            .map_err(|e| format!("Failed to emit response: {}", e))?;

                        // Clear buffer after successful parse
                        buffer.clear();
                    }
                }
            }
            Err(e) => return Err(format!("Failed to read response chunk: {}", e)),
        }
    }

    Ok(())
}
