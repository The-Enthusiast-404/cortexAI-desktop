import { createSignal, createEffect } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface ContextStats {
  total_tokens: number;
  max_tokens: number;
  message_count: number;
  context_percentage: number;
}

const ContextIndicator = (props: { chatId?: string | null }) => {
  const [stats, setStats] = createSignal<ContextStats | null>(null);

  // Listen for context updates
  createEffect(() => {
    const unlisten = listen<ContextStats>("context-update", (event) => {
      setStats(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  });

  // Fetch initial stats when chat changes
  createEffect(async () => {
    if (props.chatId) {
      try {
        const initialStats = await invoke<ContextStats>("get_context_stats", {
          chatId: props.chatId,
        });
        setStats(initialStats);
      } catch (error) {
        console.error("Failed to fetch context stats:", error);
      }
    } else {
      setStats(null);
    }
  });

  return (
    <div class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-3xl mx-auto">
        {stats() && (
          <div class="space-y-2">
            <div class="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Context Usage</span>
              <span>
                {Math.round(stats()!.context_percentage)}% (
                {stats()!.total_tokens} / {stats()!.max_tokens} tokens)
              </span>
            </div>
            <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class={`h-full transition-all duration-300 ${
                  stats()!.context_percentage > 90
                    ? "bg-red-500"
                    : stats()!.context_percentage > 75
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(100, stats()!.context_percentage)}%`,
                }}
              />
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {stats()!.message_count} messages in context
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextIndicator;
