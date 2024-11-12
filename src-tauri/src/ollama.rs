use serde::{Deserialize, Serialize};
use reqwest::Client;

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

#[tauri::command]
pub async fn list_models() -> Result<Vec<OllamaModel>, String> {
    let client = Client::new();

    match client.get("http://localhost:11434/api/tags")
        .send()
        .await {
            Ok(response) => {
                match response.json::<ListModelsResponse>().await {
                    Ok(models_response) => Ok(models_response.models),
                    Err(e) => Err(format!("Failed to parse response: {}", e))
                }
            },
            Err(e) => Err(format!("Failed to connect to Ollama: {}", e))
        }
}
