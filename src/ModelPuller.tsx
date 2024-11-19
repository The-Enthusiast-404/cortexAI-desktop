import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@kobalte/core";
import { Download, Loader } from "lucide-solid";

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
    <div class="p-4 space-y-4">
      <form onSubmit={pullModel} class="space-y-3">
        <div class="relative">
          <input
            type="text"
            value={modelName()}
            onInput={(e) => setModelName(e.currentTarget.value)}
            placeholder="Enter model name (e.g., llama2:7b)"
            class="w-full px-4 py-3 rounded-xl border border-chat-border-light dark:border-chat-border-dark
                   bg-chat-input-light dark:bg-chat-input-dark text-gray-900 dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                   disabled:bg-gray-50 dark:disabled:bg-gray-800
                   placeholder-gray-400 dark:placeholder-gray-500
                   transition-all"
            disabled={isPulling()}
          />
        </div>

        <Button.Root
          type="submit"
          disabled={isPulling()}
          class="w-full px-4 py-3 flex items-center justify-center gap-2
                 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700
                 text-white rounded-xl transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isPulling() ? (
            <>
              <Loader class="w-5 h-5 animate-spin" />
              <span>Pulling Model...</span>
            </>
          ) : (
            <>
              <Download class="w-5 h-5" />
              <span>Pull Model</span>
            </>
          )}
        </Button.Root>
      </form>

      {error() && (
        <div
          class="p-4 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300
                    rounded-xl border border-red-200 dark:border-red-500/20 animate-fadeIn"
        >
          {error()}
        </div>
      )}

      {progress() && (
        <div class="space-y-2">
          <div class="flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>{progress()?.status}</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
