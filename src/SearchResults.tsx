import { Component, For } from "solid-js";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResultsProps {
  results: SearchResult[];
}

const SearchResults: Component<SearchResultsProps> = (props) => {
  return (
    <div class="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h3 class="text-lg font-semibold">Web Search Results</h3>
      <For each={props.results}>
        {(result) => (
          <div class="border-l-2 border-blue-500 pl-3">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {result.title}
            </a>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {result.snippet}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Source: {new URL(result.url).hostname}
            </p>
          </div>
        )}
      </For>
    </div>
  );
};

export default SearchResults;
