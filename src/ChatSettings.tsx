import { createSignal, createEffect } from "solid-js";

export interface ModelParams {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  max_tokens: number;
}

interface ChatSettingsProps {
  onParamsChange: (params: ModelParams) => void;
}

export default function ChatSettings(props: ChatSettingsProps) {
  const [temperature, setTemperature] = createSignal(0.7);
  const [topP, setTopP] = createSignal(0.9);
  const [topK, setTopK] = createSignal(40);
  const [repeatPenalty, setRepeatPenalty] = createSignal(1.1);
  const [maxTokens, setMaxTokens] = createSignal(2048);

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
    </div>
  );
}
