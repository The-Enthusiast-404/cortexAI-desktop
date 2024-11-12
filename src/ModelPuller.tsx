import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface PullProgress {
  status: string;
  digest?: string;
  total: number;
  completed: number;
}

interface ModelPullerProps {
  onModelPulled: () => void;
}

export default function ModelPuller(props: ModelPullerProps) {
  const [modelName, setModelName] = createSignal("");
  const [isPulling, setIsPulling] = createSignal(false);
  const [progress, setProgress] = createSignal<PullProgress | null>(null);
  const [error, setError] = createSignal("");

  // Listen for progress updates
  listen<PullProgress>("pull-progress", (event) => {
    setProgress(event.payload);
  });

  const pullModel = async (e: Event) => {
    e.preventDefault();
    if (!modelName()) {
      setError("Please enter a model name");
      return;
    }

    setIsPulling(true);
    setError("");
    setProgress(null);

    try {
      await invoke("pull_model", { modelName: modelName() });
      setModelName("");
      // Call the parent's refresh function after successful pull
      props.onModelPulled();
    } catch (e) {
      setError(e as string);
    } finally {
      setIsPulling(false);
      setProgress(null);
    }
  };

  const getProgressPercentage = () => {
    const p = progress();
    if (!p || p.total === 0) return 0;
    return Math.round((p.completed / p.total) * 100);
  };

  return (
    <div class="p-4 border rounded bg-white shadow-sm">
      <h2 class="text-xl font-bold mb-4">Pull New Model</h2>

      <form onSubmit={pullModel} class="space-y-4">
        <div>
          <input
            type="text"
            value={modelName()}
            onInput={(e) => setModelName(e.currentTarget.value)}
            placeholder="Enter model name (e.g., llama2:7b)"
            class="w-full p-2 border rounded"
            disabled={isPulling()}
          />
        </div>

        <button
          type="submit"
          disabled={isPulling()}
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isPulling() ? "Pulling..." : "Pull Model"}
        </button>
      </form>

      {error() && (
        <div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error()}
        </div>
      )}

      {progress() && (
        <div class="mt-4 space-y-2">
          <div class="text-sm text-gray-600">Status: {progress()?.status}</div>
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <div class="text-sm text-gray-600">
            {getProgressPercentage()}% Complete
          </div>
        </div>
      )}
    </div>
  );
}
