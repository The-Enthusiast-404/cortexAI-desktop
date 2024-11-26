// FollowUpSuggestions.tsx
interface FollowUpSuggestion {
  text: string;
  type: "web" | "context";
}

interface FollowUpSuggestionsProps {
  suggestions: FollowUpSuggestion[];
  onSelect: (suggestion: string) => void;
}

import { Component, For } from "solid-js";

const FollowUpSuggestions: Component<FollowUpSuggestionsProps> = (props) => {
  console.log("Rendering follow-up suggestions:", props.suggestions);
  return (
    <div class="flex flex-col gap-2">
      <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
        Follow-up questions
      </div>
      <div class="flex flex-wrap gap-2">
        <For each={props.suggestions}>
          {(suggestion) => (
            <button
              onClick={() => props.onSelect(suggestion.text)}
              class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ease-in-out"
            >
              {suggestion.type === "web" ? "🌐" : "💭"}
              <span class="ml-2">{suggestion.text}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
};

export default FollowUpSuggestions;
