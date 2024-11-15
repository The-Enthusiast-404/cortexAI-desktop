mod chat;
mod ollama;

use crate::chat::chat;
use crate::ollama::{list_models, pull_model};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_models,
            pull_model,
            chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
