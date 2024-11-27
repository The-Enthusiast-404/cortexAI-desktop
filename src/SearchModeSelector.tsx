// SearchModeSelector.tsx
import { Component, For, Show, createSignal } from "solid-js";
import { searchModes, SearchMode } from "./SearchModes";

type SearchModeSelectorProps = {
  selectedMode: string;
  onModeSelect: (mode: SearchMode) => void;
  onExampleSelect?: (query: string) => void;
};

const SearchModeSelector: Component<SearchModeSelectorProps> = (props) => {
  const [hoveredMode, setHoveredMode] = createSignal<SearchMode | null>(null);

  const handleExampleClick = (query: string, mode: SearchMode) => {
    props.onModeSelect(mode);
    props.onExampleSelect?.(query);
  };

  return (
    <div class="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-2 space-y-1">
        <For each={searchModes}>
          {(mode) => (
            <div
              class="relative"
              onMouseEnter={() => setHoveredMode(mode)}
              onMouseLeave={() => setHoveredMode(null)}
            >
              <button
                onClick={() => props.onModeSelect(mode)}
                class={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors
                  ${
                    props.selectedMode === mode.id
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
              >
                <span class="mr-3 text-lg">{mode.icon}</span>
                <div class="flex-1">
                  <div class="font-medium">{mode.name}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {mode.description}
                  </div>
                </div>
              </button>

              <Show when={hoveredMode()?.id === mode.id}>
                <div class="absolute left-full top-0 ml-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div class="text-sm font-medium mb-2">Example queries:</div>
                  <ul class="space-y-2">
                    <For each={mode.exampleQueries}>
                      {(query) => (
                        <li
                          onClick={() => handleExampleClick(query, mode)}
                          class="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                        >
                          {query}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default SearchModeSelector;
