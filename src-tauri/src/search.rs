use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use scraper::{Html, Selector};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
    pub source_type: Option<String>,  // Added to identify academic sources
    pub authors: Option<Vec<String>>, // Added for academic papers
    pub publish_date: Option<String>, // Added for academic papers
    pub doi: Option<String>,         // Added for academic papers
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub query: String,
}

async fn search_academic(query: &str) -> Result<Vec<SearchResult>, Box<dyn Error>> {
    let client = Client::new();
    let mut all_results = Vec::new();

    // 1. Semantic Scholar Search
    let semantic_url = format!(
        "https://api.semanticscholar.org/graph/v1/paper/search?query={}&limit=5&fields=title,abstract,url,year,authors,externalIds",
        urlencoding::encode(query)
    );

    let semantic_response = client
        .get(&semantic_url)
        .header("User-Agent", "CortexAI Research Assistant (academic search)")
        .send()
        .await?;

    if semantic_response.status().is_success() {
        let semantic_data: SemanticScholarResponse = semantic_response.json().await?;
        all_results.extend(parse_semantic_scholar_results(semantic_data));
    }

    // 2. arXiv Search
    let arxiv_url = format!(
        "http://export.arxiv.org/api/query?search_query=all:{}&start=0&max_results=5",
        urlencoding::encode(query)
    );

    let arxiv_response = client
        .get(&arxiv_url)
        .header("User-Agent", "CortexAI Research Assistant (academic search)")
        .send()
        .await?;

    if arxiv_response.status().is_success() {
        let arxiv_text = arxiv_response.text().await?;
        all_results.extend(parse_arxiv_results(&arxiv_text)?);
    }

    // 3. Crossref Search
    let crossref_url = format!(
        "https://api.crossref.org/works?query={}&rows=5&select=DOI,title,abstract,author,published-print",
        urlencoding::encode(query)
    );

    let crossref_response = client
        .get(&crossref_url)
        .header("User-Agent", "CortexAI Research Assistant (academic search)")
        .send()
        .await?;

    if crossref_response.status().is_success() {
        let crossref_data = crossref_response.json::<CrossrefResponse>().await?;
        all_results.extend(parse_crossref_results(crossref_data));
    }

    // Remove duplicates based on DOI
    all_results.sort_by(|a, b| b.publish_date.cmp(&a.publish_date));
    all_results.dedup_by(|a, b| {
        a.doi.is_some() && b.doi.is_some() && a.doi == b.doi
    });

    // Take top 10 most recent results
    all_results.truncate(10);
    Ok(all_results)
}

#[derive(Deserialize)]
struct ArxivEntry {
    title: String,
    summary: String,
    published: String,
    author: Vec<ArxivAuthor>,
    link: Vec<ArxivLink>,
}

#[derive(Deserialize)]
struct ArxivAuthor {
    name: String,
}

#[derive(Deserialize)]
struct ArxivLink {
    #[serde(rename = "href")]
    url: String,
    rel: String,
}

fn parse_arxiv_results(xml: &str) -> Result<Vec<SearchResult>, Box<dyn Error>> {
    let doc = roxmltree::Document::parse(xml)?;
    let mut results = Vec::new();

    for entry in doc.descendants().filter(|n| n.has_tag_name("entry")) {
        let title = entry.descendants()
            .find(|n| n.has_tag_name("title"))
            .map(|n| n.text().unwrap_or("").trim().to_string())
            .unwrap_or_default();

        let abstract_ = entry.descendants()
            .find(|n| n.has_tag_name("summary"))
            .map(|n| n.text().unwrap_or("").trim().to_string())
            .unwrap_or_default();

        let authors: Vec<String> = entry.descendants()
            .filter(|n| n.has_tag_name("author"))
            .filter_map(|n| n.descendants().find(|c| c.has_tag_name("name")))
            .filter_map(|n| n.text())
            .map(|s| s.trim().to_string())
            .collect();

        let url = entry.descendants()
            .find(|n| n.has_tag_name("id"))
            .map(|n| n.text().unwrap_or("").trim().to_string())
            .unwrap_or_default();

        let publish_date = entry.descendants()
            .find(|n| n.has_tag_name("published"))
            .map(|n| n.text().unwrap_or("").trim().to_string())
            .map(|d| d.split('T').next().unwrap_or("").to_string());

        results.push(SearchResult {
            title,
            url,
            snippet: abstract_,
            source_type: Some("arxiv".to_string()),
            authors: Some(authors),
            publish_date,
            doi: None,
        });
    }

    Ok(results)
}

#[derive(Deserialize)]
struct CrossrefResponse {
    message: CrossrefMessage,
}

#[derive(Deserialize)]
struct CrossrefMessage {
    items: Vec<CrossrefWork>,
}

#[derive(Deserialize)]
struct CrossrefWork {
    DOI: String,
    title: Vec<String>,
    abstract_: Option<String>,
    author: Option<Vec<CrossrefAuthor>>,
    #[serde(rename = "published-print")]
    published: Option<CrossrefDate>,
}

#[derive(Deserialize)]
struct CrossrefAuthor {
    given: Option<String>,
    family: Option<String>,
}

#[derive(Deserialize, Clone)]
struct CrossrefDate {
    #[serde(rename = "date-parts")]
    date_parts: Vec<Vec<i32>>,
}

fn parse_crossref_results(response: CrossrefResponse) -> Vec<SearchResult> {
    response.message.items.into_iter()
        .map(|work| {
            let authors = work.author.map(|authors| {
                authors.into_iter()
                    .filter_map(|author| {
                        match (author.given, author.family) {
                            (Some(given), Some(family)) => Some(format!("{} {}", given, family)),
                            (None, Some(family)) => Some(family),
                            (Some(given), None) => Some(given),
                            (None, None) => None,
                        }
                    })
                    .collect()
            });

            let publish_date = work.published
                .map(|date| {
                    date.date_parts
                        .get(0)
                        .and_then(|parts| parts.get(0))
                        .map(|year| year.to_string())
                })
                .flatten();

            SearchResult {
                title: work.title.first().cloned().unwrap_or_default(),
                url: format!("https://doi.org/{}", work.DOI),
                snippet: work.abstract_.unwrap_or_default(),
                source_type: Some("crossref".to_string()),
                authors,
                publish_date,
                doi: Some(work.DOI),
            }
        })
        .collect()
}

#[derive(Debug, Serialize, Deserialize)]
struct Author {
    name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExternalIds {
    #[serde(rename = "DOI")]
    doi: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Paper {
    title: String,
    abstract_: Option<String>,
    url: Option<String>,
    year: Option<i32>,
    authors: Vec<Author>,
    externalIds: Option<ExternalIds>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SemanticScholarResponse {
    data: Vec<Paper>,
}

fn parse_semantic_scholar_results(response: SemanticScholarResponse) -> Vec<SearchResult> {
    response.data.into_iter()
        .map(|paper| {
            SearchResult {
                title: paper.title,
                url: paper.url.unwrap_or_default(),
                snippet: paper.abstract_.unwrap_or_default(),
                source_type: Some("academic".to_string()),
                authors: Some(paper.authors.into_iter().map(|a| a.name).collect()),
                publish_date: paper.year.map(|y| y.to_string()),
                doi: paper.externalIds.and_then(|ids| ids.doi),
            }
        })
        .collect()
}

pub async fn search_web(query: &str, mode: &str) -> Result<SearchResponse, Box<dyn Error>> {
    println!("Searching for query: {} in mode: {}", query, mode);
    
    let results = match mode {
        "academic" => search_academic(query).await?,
        _ => {
            let client = Client::new();
            let url = format!(
                "https://html.duckduckgo.com/html/?q={}",
                urlencoding::encode(query)
            );
            
            let response = client
                .get(&url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                .send()
                .await?;
            
            let html = response.text().await?;
            let document = Html::parse_document(&html);
            let mut results = parse_regular_results(&document);
            results.truncate(5);
            results
        }
    };

    Ok(SearchResponse {
        results,
        query: query.to_string(),
    })
}

fn parse_regular_results(document: &Html) -> Vec<SearchResult> {
    let result_selector = Selector::parse(".result").unwrap();
    let title_selector = Selector::parse(".result__title a").unwrap();
    let snippet_selector = Selector::parse(".result__snippet").unwrap();
    
    let mut results = Vec::new();
    
    for result in document.select(&result_selector) {
        if let Some(title_element) = result.select(&title_selector).next() {
            let title = title_element.text().collect::<Vec<_>>().join(" ").trim().to_string();
            let url = title_element.value().attr("href").unwrap_or("").to_string();
            
            let snippet = result
                .select(&snippet_selector)
                .next()
                .map(|s| s.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .unwrap_or_default();
                
            results.push(SearchResult {
                title,
                url,
                snippet,
                source_type: None,
                authors: None,
                publish_date: None,
                doi: None,
            });
        }
    }
    
    results
}

#[tauri::command]
pub async fn search(query: String, mode: String) -> Result<SearchResponse, String> {
    search_web(&query, &mode)
        .await
        .map_err(|e| format!("Search failed: {}", e))
}