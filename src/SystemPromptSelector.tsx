// src/SystemPromptSelector.tsx
import { For } from "solid-js";
import { SystemPrompt, predefinedPrompts } from "./SystemPrompts";

interface SystemPromptSelectorProps {
  selectedPromptId: string;
  onSelect: (promptId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
}

export default function SystemPromptSelector(props: SystemPromptSelectorProps) {
  return (
    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-3">
        <For each={predefinedPrompts}>
          {(prompt) => (
            <button
              class={`p-3 rounded-lg border ${
                props.selectedPromptId === prompt.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => props.onSelect(prompt.id)}
            >
              <div class="text-left">
                <div class="font-medium">{prompt.name}</div>
                <div class="text-sm text-gray-500">{prompt.description}</div>
              </div>
            </button>
          )}
        </For>
      </div>

      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Custom System Prompt
        </label>
        <textarea
          class="w-full h-32 p-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={props.customPrompt || ""}
          onInput={(e) => props.onCustomPromptChange?.(e.currentTarget.value)}
          placeholder="Enter your custom system prompt here..."
        />
      </div>
    </div>
  );
}
