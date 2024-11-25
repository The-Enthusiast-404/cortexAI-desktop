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
import { save, open } from "@tauri-apps/plugin-dialog";
import { desktopDir } from "@tauri-apps/api/path";
import { Button } from "@kobalte/core";
import {
  MessageSquare,
  Send,
  Settings,
  Download,
  Upload,
  Loader,
  Moon,
  Sun,
  Bot,
  User,
  Globe,
} from "lucide-solid";
import ContextIndicator from "./ContextIndicator";
import SearchResults from "./SearchResults";

interface Chat {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id?: string;
  role: string;
  content: string;
  isPinned?: boolean;
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

interface SearchResponse {
  results: SearchResult[];
  query: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
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
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const [modelParams, setModelParams] = createSignal<ModelParams>({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    max_tokens: 2048,
  });

  const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = createSignal(false);

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
      })
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
      })
    );

    onCleanup(() => {
      unlisteners.forEach((unlisten) => unlisten());
    });
  });

  const toggleMessagePin = async (index: number) => {
    try {
      const message = messages()[index];
      const messageId = message.id;

      // Call backend to toggle pin
      await invoke("toggle_message_pin", { messageId });

      // Update local state
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[index] = {
          ...newMessages[index],
          isPinned: !newMessages[index].isPinned,
        };
        return newMessages;
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(`Failed to toggle message pin: ${errorMessage}`);
    }
  };

  const getPinnedMessages = () => {
    return messages().filter((msg) => msg.isPinned);
  };

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

      // Create user message with UUID
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
        isPinned: false,
      };

      // Clear input and set generating state
      setCurrentInput("");
      setIsGenerating(true);
      setError(undefined);

      // Perform web search if enabled
      if (isWebSearchEnabled()) {
        console.log("Performing web search for:", userInput);
        try {
          const searchResponse = await invoke<SearchResponse>("search", {
            query: userInput,
          });
          console.log("Got search results:", searchResponse);

          // Create a context message from search results
          const searchContext = searchResponse.results
            .map(
              (result) => `[${result.title}](${result.url})\n${result.snippet}`
            )
            .join("\n\n");

          // Create a prompt that includes search results
          const searchPrompt = `I want you to act as a helpful AI assistant. I will provide you with search results and a query. Your task is to analyze these search results and provide a comprehensive, well-structured response that answers the query. Include relevant citations to the sources.

Query: ${userInput}

Search Results:
${searchContext}

Please provide a detailed response that:
1. Summarizes the key information from the search results
2. Directly answers the query
3. Includes relevant citations using [Source Title](URL) format
4. Mentions any limitations or uncertainties in the information
5. Provides a balanced view of the topic`;

          // Update messages immediately with user's message
          setMessages((prev) => [...prev, userMessage]);

          // Invoke chat with search context
          await invoke("chat", {
            model: props.modelName,
            messages: [
              ...messages(),
              userMessage,
              {
                role: "system",
                content: searchPrompt,
              },
            ],
            params: modelParams(),
            chatId: currentChatId,
          });
        } catch (searchError) {
          console.error("Search failed:", searchError);
          setError(`Search failed: ${searchError}`);
          setIsGenerating(false);
        }
      } else {
        // Regular chat without search
        setMessages((prev) => [...prev, userMessage]);

        await invoke("chat", {
          model: props.modelName,
          messages: [...messages(), userMessage],
          params: modelParams(),
          chatId: currentChatId,
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setError(`Failed to send message: ${error}`);
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!props.chatId) return;

    try {
      const suggestedFilename = `chat-${props.chatId}-${
        new Date().toISOString().split("T")[0]
      }.json`;
      const filePath = await save({
        filters: [
          {
            name: "Chat Export",
            extensions: ["json"],
          },
        ],
        defaultPath: suggestedFilename,
      });

      if (filePath) {
        const exportData = await invoke<string>("export_chat", {
          chatId: props.chatId,
        });
        const encoder = new TextEncoder();
        const data = encoder.encode(exportData);
        await writeFile(filePath, data);
        // toast.success('Chat exported successfully');
      }
    } catch (error) {
      console.error("Failed to export chat:", error);
      // toast.error('Failed to export chat');
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        filters: [
          {
            name: "Chat Export",
            extensions: ["json"],
          },
        ],
      });

      if (selected) {
        const newChatId = await invoke<string>("import_chat", {
          filePath: selected as string,
        });

        // Navigate to the newly imported chat
        if (props.onNewChat) {
          props.onNewChat(newChatId);
        }
      }
    } catch (error) {
      console.error("Failed to import chat:", error);
      setError("Failed to import chat: " + error);
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
            <div class="flex items-center space-x-2 px-4">
              <Show when={props.chatId}>
                <Button.Root
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-gray-900 dark:text-white"
                  onClick={handleExport}
                >
                  <Download class="h-4 w-4 mr-2" />
                  Export
                </Button.Root>
                <Button.Root
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-gray-900 dark:text-white"
                  onClick={handleImport}
                >
                  <Upload class="h-4 w-4 mr-2" />
                  Import
                </Button.Root>
              </Show>
              <Button.Root
                class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                onClick={() => setShowSettings(!showSettings())}
              >
                <Settings class="h-4 w-4" />
              </Button.Root>
            </div>
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

      {/* Search Results */}
      {searchResults().length > 0 && (
        <SearchResults results={searchResults()} />
      )}

      {/* Messages Container */}
      <div class="flex-1 overflow-y-auto scroll-smooth no-scrollbar">
        <div class="max-w-3xl mx-auto px-4">
          <For each={messages()}>
            {(message, index) => (
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
                      <MessageContent
                        content={message.content}
                        isPinned={message.isPinned}
                        showPinControls={true}
                        onTogglePin={() => toggleMessagePin(index())}
                      />
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
        <form onSubmit={sendMessage} class="flex items-center space-x-2 p-4">
          <button
            type="button"
            onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled())}
            class={`p-2 rounded-lg transition-colors ${
              isWebSearchEnabled()
                ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={
              isWebSearchEnabled()
                ? "Web search enabled"
                : "Web search disabled"
            }
          >
            <Globe size={20} />
          </button>
          <div class="flex-1 relative">
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
