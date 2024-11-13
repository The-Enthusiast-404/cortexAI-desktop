import { createSignal, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface ModelListProps {
  onModelSelect: (modelName: string) => void;
}

export default function ModelList(props: ModelListProps) {
  const [models, setModels] = createSignal<OllamaModel[]>([]);
  const [error, setError] = createSignal<string>("");
  const [selectedModel, setSelectedModel] = createSignal<string>("");

  const fetchModels = async () => {
    try {
      const modelList = await invoke<OllamaModel[]>("list_models");
      setModels(modelList);
      setError("");
    } catch (e) {
      setError(e as string);
    }
  };

  createEffect(() => {
    fetchModels();
  });

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
    props.onModelSelect(modelName);
  };

  return (
    <div class="py-2">
      {error() && (
        <div class="mx-4 mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error()}
        </div>
      )}

      <div class="space-y-1">
        {models().map((model) => (
          <button
            class={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-100 ${
              selectedModel() === model.name
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700"
            }`}
            onClick={() => handleModelSelect(model.name)}
          >
            <div class="flex items-center">
              <div class="flex-1">
                <h3 class="font-medium">{model.name}</h3>
                <div class="text-xs text-gray-500 mt-1">
                  <span class="inline-block">
                    {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
                  </span>
                  <span class="mx-2">•</span>
                  <span class="inline-block">
                    {new Date(model.modified_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {selectedModel() === model.name && (
                <div class="text-blue-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
