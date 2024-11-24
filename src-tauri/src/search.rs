use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use scraper::{Html, Selector};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub query: String,
}

pub async fn search_web(query: &str) -> Result<SearchResponse, Box<dyn Error>> {
    println!("Searching for query: {}", query);
    let client = Client::new();
    
    let url = format!(
        "https://html.duckduckgo.com/html/?q={}",
        urlencoding::encode(query)
    );
    println!("Search URL: {}", url);

    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .send()
        .await?;
    
    println!("Got response with status: {}", response.status());
    let html = response.text().await?;
    
    let document = Html::parse_document(&html);
    let result_selector = Selector::parse(".result").unwrap();
    let title_selector = Selector::parse(".result__title a").unwrap();
    let snippet_selector = Selector::parse(".result__snippet").unwrap();

    let mut search_results = Vec::new();
    
    for result in document.select(&result_selector).take(5) {
        if let Some(title_element) = result.select(&title_selector).next() {
            let title = title_element.text().collect::<Vec<_>>().join(" ").trim().to_string();
            let url = title_element.value().attr("href").unwrap_or("").to_string();
            let snippet = result
                .select(&snippet_selector)
                .next()
                .map(|s| s.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .unwrap_or_default();

            if !title.is_empty() && !url.is_empty() {
                search_results.push(SearchResult {
                    title,
                    url,
                    snippet,
                });
            }
        }
    }

    println!("Found {} search results", search_results.len());
    Ok(SearchResponse {
        results: search_results,
        query: query.to_string(),
    })
}

#[tauri::command]
pub async fn search(query: String) -> Result<SearchResponse, String> {
    search_web(&query)
        .await
        .map_err(|e| format!("Search failed: {}", e))
}