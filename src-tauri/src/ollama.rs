use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::Window;

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListModelsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PullProgress {
    pub status: String,
    pub digest: Option<String>,
    #[serde(default)]
    pub total: u64,
    #[serde(default)]
    pub completed: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelDetails {
    pub license: String,
    pub modelfile: String,
    pub parameters: String,
    pub template: String,
    pub context_window: usize,  // Context window size
    pub system: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShowModelResponse {
    pub details: ModelDetails,
}

#[tauri::command]
pub async fn list_models() -> Result<Vec<OllamaModel>, String> {
    let client = Client::new();

    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => match response.json::<ListModelsResponse>().await {
            Ok(models_response) => Ok(models_response.models),
            Err(e) => Err(format!("Failed to parse response: {}", e)),
        },
        Err(e) => Err(format!("Failed to connect to Ollama: {}", e)),
    }
}

#[tauri::command]
pub async fn pull_model(window: Window, model_name: String) -> Result<(), String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/pull";

    let payload = serde_json::json!({
        "name": model_name
    });

    let response = match client.post(url).json(&payload).send().await {
        Ok(res) => res,
        Err(e) => return Err(format!("Failed to start pull: {}", e)),
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
                    if let Ok(progress) = serde_json::from_str::<PullProgress>(&text) {
                        // Emit progress event to frontend
                        window
                            .emit("pull-progress", &progress)
                            .map_err(|e| format!("Failed to emit progress: {}", e))?;

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

#[tauri::command]
pub async fn get_model_details(model_name: String) -> Result<ModelDetails, String> {
    let client = Client::new();
    let url = "http://localhost:11434/api/show";
    
    let payload = serde_json::json!({
        "name": model_name
    });

    match client.post(url).json(&payload).send().await {
        Ok(response) => match response.json::<ShowModelResponse>().await {
            Ok(model_response) => Ok(model_response.details),
            Err(e) => Err(format!("Failed to parse model details: {}", e)),
        },
        Err(e) => Err(format!("Failed to connect to Ollama: {}", e)),
    }
}
