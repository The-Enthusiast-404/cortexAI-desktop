import {
  createSignal,
  createEffect,
  For,
  onMount,
  onCleanup,
  Show,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import MessageContent from "./MessageContent";
import ChatSettings, { ModelParams } from "./ChatSettings";
import { writeFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import { desktopDir } from "@tauri-apps/api/path";
import { Button } from "@kobalte/core";
import {
  MessageSquare,
  Send,
  Settings,
  Download,
  Loader,
  Moon,
  Sun,
  Bot,
  User,
} from "lucide-solid";
import ContextIndicator from "./ContextIndicator";

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
  const [isExporting, setIsExporting] = createSignal(false);
  const [isDark, setIsDark] = createSignal(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const [modelParams, setModelParams] = createSignal<ModelParams>({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    max_tokens: 2048,
  });

  let messagesEndRef: HTMLDivElement | undefined;
  const scrollToBottom = () => {
    messagesEndRef?.scrollIntoView({ behavior: "smooth" });
  };
  createEffect(() => {
    // Trigger scroll when messages change or currentResponse changes
    messages();
    currentResponse();
    scrollToBottom();
  });

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

  onMount(async () => {
    const unlisteners: UnlistenFn[] = [];

    unlisteners.push(
      await listen<ChatResponse>("chat-response", (event) => {
        if (!event.payload.done) {
          setCurrentResponse((prev) => prev + event.payload.message.content);
        }
      }),
    );

    unlisteners.push(
      await listen<StreamResponse>("chat-complete", (event) => {
        if (event.payload.done) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: currentResponse() },
          ]);
          setCurrentResponse("");
          setIsGenerating(false);
        }
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

      // Create a new chat if needed
      if (!currentChatId) {
        const chat = await invoke<Chat>("create_chat", {
          title: userInput.slice(0, 50),
          model: props.modelName,
        });
        currentChatId = chat.id;
        props.onNewChat?.(chat.id);
      }

      // Create user message
      const userMessage = { role: "user", content: userInput };

      // Clear input and set generating state
      setCurrentInput("");
      setIsGenerating(true);
      setError(undefined);

      // Update messages immediately with user's message
      setMessages((prev) => [...prev, userMessage]);

      // Invoke chat after updating UI
      await invoke("chat", {
        model: props.modelName,
        messages: [...messages(), userMessage], // Include the new message
        params: modelParams(),
        chatId: currentChatId,
      });
    } catch (error) {
      console.error("Chat error:", error);
      setError(`Failed to send message: ${error}`);
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!props.chatId || isExporting()) return;

    try {
      setIsExporting(true);
      setError(undefined);

      const jsonData = await invoke<string>("export_chat", {
        chatId: props.chatId,
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const suggestedName = `chat-export-${timestamp}.json`;
      const defaultPath = await desktopDir();

      const filePath = await save({
        defaultPath: `${defaultPath}${suggestedName}`,
        filters: [
          {
            name: "JSON Files",
            extensions: ["json"],
          },
        ],
      });

      if (filePath) {
        const encoder = new TextEncoder();
        const binaryData = encoder.encode(jsonData);
        await writeFile(filePath, binaryData);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(`Failed to export chat: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Fixed dark mode effect
  createEffect(() => {
    if (isDark()) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  });

  return (
    <div class="flex flex-col h-full bg-chat-lighter dark:bg-chat-dark">
      {/* Header */}
      <div class="sticky top-0 z-10 flex-none px-4 py-3 border-b border-chat-border-light dark:border-chat-border-dark bg-chat-light/80 dark:bg-chat-darker/80 backdrop-blur supports-[backdrop-filter]:bg-chat-light/60 dark:supports-[backdrop-filter]:bg-chat-darker/60">
        <div class="flex items-center justify-between max-w-3xl mx-auto">
          <div class="flex items-center gap-3">
            <MessageSquare class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 class="font-medium text-gray-900 dark:text-white">
              {props.modelName}
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <Button.Root
              onClick={() => setIsDark(!isDark())}
              class="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <Show when={isDark()} fallback={<Moon class="w-5 h-5" />}>
                <Sun class="w-5 h-5" />
              </Show>
            </Button.Root>
            {props.chatId && (
              <Button.Root
                onClick={handleExport}
                disabled={isExporting()}
                class="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
                title="Export Chat"
              >
                <Show
                  when={!isExporting()}
                  fallback={<Loader class="w-5 h-5 animate-spin" />}
                >
                  <Download class="w-5 h-5" />
                </Show>
              </Button.Root>
            )}
            <Button.Root
              onClick={() => setShowSettings(!showSettings())}
              class="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <Settings class="w-5 h-5" />
            </Button.Root>
          </div>
        </div>
      </div>
      <ContextIndicator chatId={props.chatId} />

      {/* Settings Panel */}
      <Show when={showSettings()}>
        <div class="flex-none border-b border-chat-border-light dark:border-chat-border-dark animate-slideDown bg-chat-light dark:bg-chat-darker">
          <div class="max-w-3xl mx-auto w-full">
            <ChatSettings onParamsChange={setModelParams} />
          </div>
        </div>
      </Show>

      {/* Error Display */}
      <Show when={error()}>
        <div class="mx-auto max-w-3xl w-full px-4 mt-4">
          <div class="p-4 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-500/20 animate-fadeIn">
            {error()}
          </div>
        </div>
      </Show>

      {/* Messages Container */}
      {/* Messages Container */}
      <div class="flex-1 overflow-y-auto scroll-smooth no-scrollbar">
        <div class="max-w-3xl mx-auto px-4">
          <For each={messages()}>
            {(message) => (
              <div class="py-6 first:pt-8 border-b border-chat-border-light dark:border-chat-border-dark animate-messageIn">
                <div class="flex gap-4 items-start">
                  <div
                    class={`flex-none p-2 rounded-full ${
                      message.role === "user"
                        ? "bg-blue-600 dark:bg-blue-500"
                        : "bg-green-600 dark:bg-green-500"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User class="w-4 h-4 text-white" />
                    ) : (
                      <Bot class="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div
                      class={`prose dark:prose-invert max-w-none ${
                        message.role === "user"
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      <MessageContent content={message.content} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>

          <Show when={currentResponse()}>
            <div class="py-6 border-b border-chat-border-light dark:border-chat-border-dark animate-messageIn">
              <div class="flex gap-4 items-start">
                <div class="flex-none p-2 rounded-full bg-green-600 dark:bg-green-500">
                  <Bot class="w-4 h-4 text-white" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="prose dark:prose-invert max-w-none text-gray-900 dark:text-white">
                    <MessageContent content={currentResponse()} />
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Invisible element for scroll reference */}
          <div ref={messagesEndRef} class="h-4" />
        </div>
      </div>

      {/* Input Form */}
      <div class="flex-none border-t border-chat-border-light dark:border-chat-border-dark bg-chat-light/80 dark:bg-chat-darker/80 backdrop-blur supports-[backdrop-filter]:bg-chat-light/60 dark:supports-[backdrop-filter]:bg-chat-darker/60">
        <form onSubmit={sendMessage} class="max-w-3xl mx-auto p-4">
          <div class="relative flex items-center">
            <input
              type="text"
              value={currentInput()}
              onInput={(e) => setCurrentInput(e.currentTarget.value)}
              placeholder="Type your message..."
              class="w-full pl-4 pr-12 py-3 rounded-xl border border-chat-border-light dark:border-chat-border-dark
                     bg-chat-input-light dark:bg-chat-input-dark text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                     disabled:bg-gray-50 dark:disabled:bg-gray-800
                     placeholder-gray-400 dark:placeholder-gray-500
                     transition-all"
              disabled={isGenerating()}
            />
            <div class="absolute right-2 flex items-center">
              <Button.Root
                type="submit"
                disabled={isGenerating()}
                class="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
                       disabled:opacity-50 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500
                       transition-colors rounded-lg"
              >
                <Show
                  when={!isGenerating()}
                  fallback={<Loader class="w-5 h-5 animate-spin" />}
                >
                  <Send class="w-5 h-5" />
                </Show>
              </Button.Root>
            </div>
          </div>

          {/* Optional typing indicator */}
          <Show when={isGenerating()}>
            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              AI is generating response...
            </div>
          </Show>
        </form>
      </div>
    </div>
  );
}
