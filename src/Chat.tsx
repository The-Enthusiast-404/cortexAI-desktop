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
  Sparkles,
} from "lucide-solid";
import ContextIndicator from "./ContextIndicator";
import SearchResults from "./SearchResults";
import SystemPromptSelector from "./SystemPromptSelector";
import FollowUpSuggestions from "./FollowUpSuggestions";
import { predefinedPrompts } from "./SystemPrompts";
import { generateAcademicPrompt } from "./AcademicPrompts";
import FocusMode from "./FocusMode";

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
  systemPromptType?: string;
}

interface ChatProps {
  modelName: string;
  chatId?: string | null;
  onNewChat?: (chatId: string) => void;
}

interface FollowUpSuggestion {
  text: string;
  type_: "web" | "context"; // Match the Rust field name
}

interface ChatResponse {
  message: ChatMessage;
  done: boolean;
  follow_ups?: FollowUpSuggestion[];
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
  source_type?: string;
  authors?: string[];
  publish_date?: string;
  doi?: string;
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

  const [selectedPromptId, setSelectedPromptId] = createSignal("general");
  const [customPrompt, setCustomPrompt] = createSignal("");
  const [activeSystemPrompt, setActiveSystemPrompt] = createSignal("");

  const [followUps, setFollowUps] = createSignal<FollowUpSuggestion[]>([]);
  const [searchMode, setSearchMode] = createSignal<string>("general");

  const [mode, setMode] = createSignal("offline");

  const getCurrentSystemPrompt = () => {
    if (activeSystemPrompt()) return activeSystemPrompt();
    const defaultPrompt = predefinedPrompts.find((p) => p.id === "general");
    return defaultPrompt?.prompt || "";
  };

  const handleApplyPrompt = () => {
    const newPrompt =
      customPrompt() ||
      predefinedPrompts.find((p) => p.id === selectedPromptId())?.prompt ||
      "";
    console.log(
      "Applying new system prompt:",
      newPrompt.substring(0, 100) + "..."
    ); // Debug log
    setActiveSystemPrompt(newPrompt);
    setShowSettings(false);
  };

  const handleFollowUpSelect = (suggestion: string) => {
    setCurrentInput(suggestion);
    setFollowUps([]); // Clear suggestions after selection
  };

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
        // Accumulate streaming response
        setCurrentResponse((prev) => prev + event.payload.message.content);
      })
    );

    // Handle completion with follow-ups
    unlisteners.push(
      await listen<ChatResponse>("chat-complete", (event) => {
        // Add final message to the list
        const finalResponse = currentResponse();
        if (finalResponse.trim()) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: finalResponse },
          ]);
        }
        setCurrentResponse("");

        // Set follow-ups and stop generating
        setFollowUps(event.payload.follow_ups || []);
        setIsGenerating(false);
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

  const sendMessage = async (e?: Event) => {
    e?.preventDefault();
    const userInput = currentInput().trim();

    if (!userInput || isGenerating()) return;

    let currentChatId = props.chatId;

    try {
      const systemPrompt = getCurrentSystemPrompt();
      const systemPromptType = customPrompt() ? "custom" : selectedPromptId();

      console.log("Using system prompt:", {
        id: selectedPromptId(),
        type: systemPromptType,
        customPrompt: customPrompt() ? "present" : "none",
        activePrompt: systemPrompt.substring(0, 100) + "...",
      });

      // Create user message with system prompt type
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
        isPinned: false,
        systemPromptType: systemPromptType,
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
            mode: searchMode(),
          });
          console.log("Got search results:", searchResponse);

          // Create a context message from search results
          const searchContext = searchResponse.results
            .map((result) => {
              let citation = `[${result.title}](${result.url})\n${result.snippet}`;
              // Add academic metadata if available
              if (result.source_type === "academic") {
                if (result.authors && result.authors.length > 0) {
                  citation += `\nAuthors: ${result.authors.join(", ")}`;
                }
                if (result.publish_date) {
                  citation += `\nPublished: ${result.publish_date}`;
                }
                if (result.doi) {
                  citation += `\nDOI: ${result.doi}`;
                }
              }
              return citation;
            })
            .join("\n\n");

          // Create a mode-specific prompt
          const searchPrompt =
            searchMode() === "academic"
              ? generateAcademicPrompt({
                  query: userInput,
                  searchContext: searchContext,
                })
              : `I want you to act as a helpful AI assistant. I will provide you with search results and a query. Your task is to analyze these search results and provide a comprehensive, well-structured response that answers the query. Include relevant citations to the sources.

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
            systemPrompt: systemPrompt,
            webSearch: isWebSearchEnabled(),
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
          systemPrompt: systemPrompt,
          systemPromptType: systemPromptType,
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

  // Add effect to scroll when follow-ups appear
  createEffect(() => {
    if (followUps().length > 0) {
      setTimeout(() => {
        messagesEndRef?.scrollIntoView({ behavior: "smooth" });
      }, 100); // Small delay to ensure DOM is updated
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
                <Settings class="h-4 w-4 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white" />
              </Button.Root>
            </div>
          </div>
        </div>
      </div>
      <ContextIndicator chatId={props.chatId} />

      {/* Settings Panel */}
      <Show when={showSettings()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div class="absolute right-0 top-0 h-full w-96 bg-white shadow-lg overflow-y-auto">
            <div class="p-4">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-medium">Chat Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  class="text-gray-500 hover:text-gray-700"
                >
                  <span class="sr-only">Close</span>
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div class="space-y-6">
                <div>
                  <h3 class="text-md font-medium mb-3">System Prompt</h3>
                  <SystemPromptSelector
                    selectedPromptId={selectedPromptId()}
                    onSelect={setSelectedPromptId}
                    customPrompt={customPrompt()}
                    onCustomPromptChange={setCustomPrompt}
                  />
                  <div class="mt-4">
                    <button
                      onClick={handleApplyPrompt}
                      class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Apply System Prompt
                    </button>
                  </div>
                </div>

                <ChatSettings
                  modelParams={modelParams()}
                  onParamsChange={setModelParams}
                  isWebSearchEnabled={isWebSearchEnabled()}
                  onWebSearchChange={setIsWebSearchEnabled}
                  searchMode={searchMode()}
                  onSearchModeChange={setSearchMode}
                />
              </div>
            </div>
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
                  <div class="flex flex-col items-center gap-2">
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
                    {message.systemPromptType && (
                      <div class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        {message.systemPromptType === "custom"
                          ? "Custom"
                          : message.systemPromptType}
                      </div>
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

          {/* Show follow-ups after response is complete */}
          <Show
            when={
              !isGenerating() &&
              currentResponse() === "" &&
              followUps().length > 0
            }
          >
            <div class="py-6 px-4 bg-gray-50 dark:bg-gray-800/50 border-t border-b border-gray-100 dark:border-gray-800 animate-fadeIn">
              <div class="max-w-3xl mx-auto">
                <FollowUpSuggestions
                  suggestions={followUps().map((f) => ({
                    text: f.text,
                    type: f.type_,
                  }))}
                  onSelect={handleFollowUpSelect}
                />
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
            <div
              class="absolute left-2 top-1/2 -translate-y-1/2"
              style={{ "z-index": 9999 }}
            >
              <FocusMode
                mode={mode()}
                onModeChange={(newMode) => setMode(newMode)}
              />
            </div>
            <input
              type="text"
              value={currentInput()}
              onInput={(e) => setCurrentInput(e.currentTarget.value)}
              placeholder="Type your message..."
              class="w-full pl-32 pr-24 py-3 bg-chat-input-light dark:bg-chat-input-dark rounded-xl border border-chat-border-light dark:border-chat-border-dark focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <Button.Root
              type="submit"
              disabled={isGenerating()}
              class="absolute right-2 p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white
                     disabled:opacity-50 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-300
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
