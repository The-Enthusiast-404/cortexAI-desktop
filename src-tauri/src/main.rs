// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cortexai_desktop_lib::{self, chat::cancel_chat_generation};

#[derive(serde::Serialize)]
pub struct SearchResponse {
    results: Vec<SearchResult>,
    query: String,
}

#[derive(serde::Serialize)]
pub struct SearchResult {
    title: String,
    url: String,
    snippet: String,
    source_type: Option<String>,
    authors: Option<Vec<String>>,
    publish_date: Option<String>,
    doi: Option<String>,
}

#[tauri::command]
async fn search(query: String, use_academic: bool, chat_id: Option<String>) -> Result<SearchResponse, String> {
    if use_academic {
        // Call the frontend's academic search function
        Ok(SearchResponse {
            results: Vec::new(), // The actual results will come from the frontend
            query,
        })
    } else {
        // Handle regular web search
        Ok(SearchResponse {
            results: Vec::new(), // Replace with your web search implementation
            query,
        })
    }
}

fn main() {
    cortexai_desktop_lib::run();
}
