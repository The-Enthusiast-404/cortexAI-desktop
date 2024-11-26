import { createSignal, createEffect, Show } from "solid-js";

export interface ModelParams {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  max_tokens: number;
}

interface ChatSettingsProps {
  modelParams: ModelParams;
  onParamsChange: (params: ModelParams) => void;
  isWebSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  searchMode: string;
  onSearchModeChange: (mode: string) => void;
}

export default function ChatSettings(props: ChatSettingsProps) {
  const [temperature, setTemperature] = createSignal(
    props.modelParams.temperature
  );
  const [topP, setTopP] = createSignal(props.modelParams.top_p);
  const [topK, setTopK] = createSignal(props.modelParams.top_k);
  const [repeatPenalty, setRepeatPenalty] = createSignal(
    props.modelParams.repeat_penalty
  );
  const [maxTokens, setMaxTokens] = createSignal(props.modelParams.max_tokens);

  createEffect(() => {
    props.onParamsChange({
      temperature: temperature(),
      top_p: topP(),
      top_k: topK(),
      repeat_penalty: repeatPenalty(),
      max_tokens: maxTokens(),
    });
  });

  return (
    <div class="p-4 space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Temperature: {temperature().toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature()}
          onInput={(e) => setTemperature(parseFloat(e.currentTarget.value))}
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Top P: {topP().toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={topP()}
          onInput={(e) => setTopP(parseFloat(e.currentTarget.value))}
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Top K: {topK()}
        </label>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          value={topK()}
          onInput={(e) => setTopK(parseInt(e.currentTarget.value))}
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Repeat Penalty: {repeatPenalty().toFixed(2)}
        </label>
        <input
          type="range"
          min="1"
          max="2"
          step="0.05"
          value={repeatPenalty()}
          onInput={(e) => setRepeatPenalty(parseFloat(e.currentTarget.value))}
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Max Tokens: {maxTokens()}
        </label>
        <input
          type="range"
          min="256"
          max="4096"
          step="256"
          value={maxTokens()}
          onInput={(e) => setMaxTokens(parseInt(e.currentTarget.value))}
          class="w-full"
        />
      </div>

      {/* Web Search Settings */}
      <div class="space-y-2">
        <div class="flex items-center">
          <input
            type="checkbox"
            id="web-search"
            checked={props.isWebSearchEnabled}
            onChange={(e) => props.onWebSearchChange(e.currentTarget.checked)}
            class="h-4 w-4 text-blue-600"
          />
          <label
            for="web-search"
            class="ml-2 text-sm font-medium text-gray-700"
          >
            Enable Web Search
          </label>
        </div>

        <Show when={props.isWebSearchEnabled}>
          <div class="mt-2">
            <label class="block text-sm font-medium text-gray-700">
              Search Mode
            </label>
            <select
              value={props.searchMode}
              onChange={(e) => props.onSearchModeChange(e.currentTarget.value)}
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="general">General</option>
              <option value="academic">Academic</option>
            </select>
          </div>
        </Show>
      </div>
    </div>
  );
}
