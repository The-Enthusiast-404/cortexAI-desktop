import { createSignal, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@kobalte/core";
import { Check, Box, Loader } from "lucide-solid";

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface ModelListProps {
  onModelSelect: (modelName: string) => void;
  selectedModel?: string | null;
}

export default function ModelList(props: ModelListProps) {
  const [models, setModels] = createSignal<OllamaModel[]>([]);
  const [error, setError] = createSignal<string>("");
  const [loading, setLoading] = createSignal(true);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const modelList = await invoke<OllamaModel[]>("list_models");
      setModels(modelList);
      setError("");
    } catch (e) {
      setError(e as string);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchModels();
  });

  return (
    <div class="py-2">
      {/* Error Display */}
      {error() && (
        <div
          class="mx-4 mb-4 p-4 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300
                    rounded-xl border border-red-200 dark:border-red-500/20 animate-fadeIn"
        >
          {error()}
        </div>
      )}

      {/* Loading State */}
      {loading() && (
        <div class="flex items-center justify-center py-8">
          <Loader class="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      )}

      {/* Models List */}
      <div class="space-y-1">
        {models().map((model) => (
          <Button.Root
            onClick={() => props.onModelSelect(model.name)}
            class={`w-full px-4 py-3 flex items-center justify-between group
                   transition-colors duration-150
                   ${
                     props.selectedModel === model.name
                       ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                       : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                   }`}
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <Box class="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <div>
                  <h3 class="font-medium text-left truncate">{model.name}</h3>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-x-2">
                    <span>
                      {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(model.modified_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {props.selectedModel === model.name && (
              <Check class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </Button.Root>
        ))}
      </div>
    </div>
  );
}
