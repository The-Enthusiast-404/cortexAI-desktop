import { createSignal, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface ModelListProps {
  onModelSelect: (modelName: string) => void; // Make this required
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
    <div class="p-4 border rounded bg-white shadow-sm">
      <h2 class="text-xl font-bold mb-4">Available Models</h2>

      {error() && (
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error()}
        </div>
      )}

      <div class="grid gap-4">
        {models().map((model) => (
          <button
            class={`text-left w-full border rounded p-4 transition-colors hover:border-blue-500 ${
              selectedModel() === model.name
                ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
                : "bg-white"
            }`}
            onClick={() => handleModelSelect(model.name)}
          >
            <h3 class="font-bold">{model.name}</h3>
            <div class="text-sm text-gray-600">
              <p>Size: {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB</p>
              <p>
                Last Modified:{" "}
                {new Date(model.modified_at).toLocaleDateString()}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
