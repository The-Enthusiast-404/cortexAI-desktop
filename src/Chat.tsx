import { createSignal, createEffect, For, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import MessageContent from "./MessageContent";
import ChatSettings, { ModelParams } from "./ChatSettings";

interface Chat {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatProps {
  modelName: string;
  chatId?: string | null;
  onNewChat?: (chatId: string) => void;
}

interface ChatResponse {
  message: ChatMessage;
  done: boolean;
}

interface StreamResponse {
  content: string;
  done: boolean;
  chat_id?: string;
}

export default function Chat(props: ChatProps) {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [currentResponse, setCurrentResponse] = createSignal("");
  const [showSettings, setShowSettings] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const [modelParams, setModelParams] = createSignal<ModelParams>({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    max_tokens: 2048,
  });

  // Load chat history when chatId changes
  createEffect(async () => {
    if (props.chatId) {
      try {
        const chatMessages = await invoke<ChatMessage[]>("get_chat_messages", {
          chatId: props.chatId,
        });
        setMessages(chatMessages);
        setError(undefined);
        setCurrentResponse("");
      } catch (e) {
        setError(`Failed to load chat history: ${e}`);
      }
    } else {
      setMessages([]);
      setCurrentResponse("");
    }
  });

  // Set up event listeners
  onMount(async () => {
    const unlisteners: UnlistenFn[] = [];

    // Listen for chat responses
    unlisteners.push(
      await listen<ChatResponse>("chat-response", (event) => {
        if (!event.payload.done) {
          setCurrentResponse((prev) => prev + event.payload.message.content);
        }
      }),
    );

    // Listen for chat completion
    unlisteners.push(
      await listen<StreamResponse>("chat-complete", (event) => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: currentResponse() },
        ]);
        setCurrentResponse("");
        setIsGenerating(false);
      }),
    );

    onCleanup(() => {
      unlisteners.forEach((unlisten) => unlisten());
    });
  });

  const sendMessage = async (e: Event) => {
    e.preventDefault();
    const userInput = currentInput().trim();

    if (!userInput || isGenerating()) return;

    try {
      let currentChatId = props.chatId;

      // If no chat_id exists, create a new chat
      if (!currentChatId) {
        const chat = await invoke<Chat>("create_chat", {
          title: userInput.slice(0, 50), // Use first 50 chars of message as title
          model: props.modelName,
        });
        currentChatId = chat.id;
        props.onNewChat?.(chat.id);
      }

      const userMessage = { role: "user", content: userInput };
      setMessages((prev) => [...prev, userMessage]);
      setCurrentInput("");
      setIsGenerating(true);
      setError(undefined);

      await invoke("chat", {
        model: props.modelName,
        messages: [...messages(), userMessage],
        params: modelParams(),
        chatId: currentChatId,
      });
    } catch (error) {
      console.error("Chat error:", error);
      setError(`Failed to send message: ${error}`);
      setIsGenerating(false);
    }
  };

  return (
    <div class="h-full flex flex-col bg-white">
      {/* Chat header */}
      <div class="flex-none p-4 border-b flex justify-between items-center">
        <h2 class="font-semibold text-gray-800">Chat with {props.modelName}</h2>
        <button
          onClick={() => setShowSettings(!showSettings())}
          class="p-2 hover:bg-gray-100 rounded-md"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Settings panel */}
      {showSettings() && (
        <div class="flex-none border-b">
          <ChatSettings onParamsChange={setModelParams} />
        </div>
      )}

      {/* Error display */}
      {error() && (
        <div class="p-4 m-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {error()}
        </div>
      )}

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <For each={messages()}>
          {(message) => (
            <div
              class={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                class={`max-w-[80%] rounded-lg p-4 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100"
                }`}
              >
                <MessageContent content={message.content} />
              </div>
            </div>
          )}
        </For>

        {currentResponse() && (
          <div class="flex justify-start">
            <div class="max-w-[80%] rounded-lg p-4 bg-gray-100">
              <MessageContent content={currentResponse()} />
            </div>
          </div>
        )}
      </div>

      {/* Input form */}
      <div class="flex-none border-t p-4">
        <form onSubmit={sendMessage} class="flex space-x-4">
          <input
            type="text"
            value={currentInput()}
            onInput={(e) => setCurrentInput(e.currentTarget.value)}
            placeholder="Type your message..."
            class="flex-1 p-2 border rounded-md focus:outline-none focus:border-blue-500"
            disabled={isGenerating()}
          />
          <button
            type="submit"
            disabled={isGenerating()}
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:hover:bg-blue-500"
          >
            {isGenerating() ? "Generating..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
