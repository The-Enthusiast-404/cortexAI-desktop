import { SearchResult } from "../types";

interface ArxivResponse {
  feed: {
    entry: Array<{
      title: string;
      summary: string;
      author: Array<{ name: string }>;
      published: string;
      link: Array<{ href: string }>;
    }>;
  };
}

interface CrossrefResponse {
  items: Array<{
    title: string[];
    author: Array<{ given: string; family: string }>;
    published: { "date-parts": number[][] };
    DOI: string;
    URL: string;
    abstract: string;
  }>;
}

export async function searchAcademic(query: string): Promise<SearchResult[]> {
  try {
    // Search both APIs concurrently
    const [arxivResults, crossrefResults] = await Promise.all([
      searchArxiv(query),
      searchCrossref(query),
    ]);

    // Combine and deduplicate results
    const combinedResults = [...arxivResults, ...crossrefResults];
    return combinedResults.slice(0, 10); // Limit to top 10 results
  } catch (error) {
    console.error("Academic search failed:", error);
    throw error;
  }
}

async function searchArxiv(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=5`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    const entries = Array.from(xmlDoc.getElementsByTagName("entry"));

    return entries.map((entry) => {
      const title = entry.getElementsByTagName("title")[0]?.textContent || "";
      const summary =
        entry.getElementsByTagName("summary")[0]?.textContent || "";
      const authors = Array.from(entry.getElementsByTagName("author")).map(
        (author) => author.getElementsByTagName("name")[0]?.textContent || ""
      );
      const published =
        entry.getElementsByTagName("published")[0]?.textContent || "";
      const link = entry.getElementsByTagName("id")[0]?.textContent || "";

      return {
        title: title.trim(),
        url: link,
        snippet: summary.trim(),
        source_type: "academic",
        authors,
        publish_date: new Date(published).toLocaleDateString(),
      };
    });
  } catch (error) {
    console.error("arXiv search failed:", error);
    return [];
  }
}

async function searchCrossref(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=5&select=title,author,published,DOI,URL,abstract`;

  try {
    const response = await fetch(url);
    const data: CrossrefResponse = await response.json();

    return data.items.map((item) => ({
      title: item.title[0] || "",
      url: item.URL || `https://doi.org/${item.DOI}`,
      snippet: item.abstract || "No abstract available",
      source_type: "academic",
      authors: item.author?.map((a) => `${a.given} ${a.family}`) || [],
      publish_date: item.published?.["date-parts"]?.[0]?.join("-") || "",
      doi: item.DOI,
    }));
  } catch (error) {
    console.error("Crossref search failed:", error);
    return [];
  }
}
