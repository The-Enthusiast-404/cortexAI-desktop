import { createSignal, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export default function ModelList() {
  const [models, setModels] = createSignal<OllamaModel[]>([]);
  const [error, setError] = createSignal<string>("");

  const fetchModels = async () => {
    try {
      const modelList = await invoke<OllamaModel[]>("list_models");
      setModels(modelList);
      setError("");
    } catch (e) {
      setError(e as string);
    }
  };

  // Fetch models when component mounts
  createEffect(() => {
    fetchModels();
  });

  return (
    <div class="p-4">
      <h2 class="text-xl font-bold mb-4">Available Models</h2>

      {error() && (
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error()}
        </div>
      )}

      <div class="grid gap-4">
        {models().map((model) => (
          <div class="border rounded p-4 bg-white shadow-sm">
            <h3 class="font-bold">{model.name}</h3>
            <div class="text-sm text-gray-600">
              <p>Size: {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB</p>
              <p>
                Last Modified:{" "}
                {new Date(model.modified_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
