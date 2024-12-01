import { Component, For, Show } from "solid-js";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source_type?: string;
  authors?: string[];
  publish_date?: string;
  doi?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  // Making query optional since it's not used in the component
  query?: string;
}

const SearchResults: Component<SearchResultsProps> = (props) => {
  const isAcademic = () => props.results[0]?.source_type === "academic";

  return (
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">
        {isAcademic() ? "Academic Search Results" : "Web Search Results"}
      </h3>
      <For each={props.results}>
        {(result) => (
          <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div class="mb-2">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {result.title}
              </a>

              <Show when={result.source_type === "academic"}>
                <div class="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  <Show when={result.authors && result.authors.length > 0}>
                    <div class="flex gap-1">
                      <span class="font-medium">Authors:</span>
                      <span>{result.authors?.join(", ")}</span>
                    </div>
                  </Show>
                  <Show when={result.publish_date}>
                    <div class="flex gap-1">
                      <span class="font-medium">Published:</span>
                      <span>{result.publish_date}</span>
                    </div>
                  </Show>
                  <Show when={result.doi}>
                    <div class="flex gap-1">
                      <span class="font-medium">DOI:</span>
                      <a
                        href={`https://doi.org/${result.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {result.doi}
                      </a>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
            <p class="text-gray-700 dark:text-gray-300 text-sm">
              {result.snippet}
            </p>
          </div>
        )}
      </For>
    </div>
  );
};

export default SearchResults;
