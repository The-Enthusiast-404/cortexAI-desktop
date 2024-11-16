import { createSignal, createEffect, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface Chat {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  onChatSelect: (chatId: string, model: string) => void;
  selectedChatId?: string | null;
  onDeleteChat?: () => void;
}

export default function ChatHistory(props: ChatHistoryProps) {
  const [chats, setChats] = createSignal<Chat[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string>("");

  const fetchChats = async () => {
    try {
      setLoading(true);
      const chatList = await invoke<Chat[]>("get_chats");
      setChats(chatList);
      setError("");
    } catch (e) {
      console.error("Error fetching chats:", e);
      setError(`Failed to load chats: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (chatId: string, e: Event) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      await invoke("delete_chat", { chatId });
      await fetchChats(); // Refresh the list
      if (props.selectedChatId === chatId) {
        props.onDeleteChat?.();
      }
    } catch (e) {
      setError(`Failed to delete chat: ${e}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fetch chats on component mount
  createEffect(() => {
    fetchChats();
  });

  return (
    <div class="h-full flex flex-col">
      <Show when={error()}>
        <div class="p-4 mb-2 bg-red-100 text-red-700 rounded">{error()}</div>
      </Show>

      <Show
        when={!loading()}
        fallback={
          <div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        }
      >
        <div class="flex-1 overflow-y-auto">
          <Show
            when={chats().length > 0}
            fallback={
              <div class="text-center p-4 text-gray-500">
                No chats yet. Select a model to start chatting.
              </div>
            }
          >
            <For each={chats()}>
              {(chat) => (
                <div
                  class={`w-full p-4 hover:bg-gray-100 flex justify-between items-center cursor-pointer
                    ${props.selectedChatId === chat.id ? "bg-blue-50" : ""}`}
                  onClick={() => props.onChatSelect(chat.id, chat.model)}
                >
                  <div class="flex-1">
                    <div class="font-medium">{chat.title}</div>
                    <div class="text-sm text-gray-500 flex items-center gap-2">
                      <span>{chat.model}</span>
                      <span>•</span>
                      <span>{formatDate(chat.updated_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    class="p-2 hover:bg-gray-200 rounded-full"
                    title="Delete chat"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 text-gray-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}
