mod chat;
mod database;
mod ollama;

use crate::database::Database;
use crate::ollama::{list_models, pull_model};
use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

// Global database instance
pub(crate) static DB: Lazy<Mutex<Option<Database>>> = Lazy::new(|| Mutex::new(None));

fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

fn initialize_database(app: &AppHandle) -> Result<(), String> {
    let app_dir = get_app_data_dir(app)?;
    println!("App directory: {}", app_dir.display()); // Debug log

    std::fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app dir: {}", e))?;

    let db_path = app_dir.join("chats.db");
    println!("Database path: {}", db_path.display()); // Debug log

    let database = Database::new(db_path.to_str().unwrap())
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    let mut db = DB.lock().unwrap();
    *db = Some(database);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            initialize_database(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_models,
            pull_model,
            chat::chat,
            chat::get_chat_messages,
            chat::get_chats,
            chat::create_chat,
            chat::delete_chat,
            chat::save_message,
            chat::toggle_message_pin,
            chat::get_context_stats,
            chat::export_chat,
            chat::import_chat,
        ])
        .plugin(tauri_plugin_dialog::init()) // Dialog plugin for file dialogs
        .plugin(tauri_plugin_fs::init()) // File system plugin
        .plugin(tauri_plugin_shell::init()) // Shell plugin
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
