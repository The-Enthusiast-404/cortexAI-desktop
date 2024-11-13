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
    <div>
      <form onSubmit={pullModel} class="space-y-2">
        <div class="relative">
          <input
            type="text"
            value={modelName()}
            onInput={(e) => setModelName(e.currentTarget.value)}
            placeholder="Enter model name (e.g., llama2:7b)"
            class="w-full px-3 py-2 border rounded-md text-sm"
            disabled={isPulling()}
          />
        </div>

        <button
          type="submit"
          disabled={isPulling()}
          class="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium
                 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-blue-600"
        >
          {isPulling() ? "Pulling..." : "Pull Model"}
        </button>
      </form>

      {error() && (
        <div class="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error()}
        </div>
      )}

      {progress() && (
        <div class="mt-2 space-y-1">
          <div class="text-xs text-gray-600">{progress()?.status}</div>
          <div class="w-full bg-gray-200 rounded-full h-1.5">
            <div
              class="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
