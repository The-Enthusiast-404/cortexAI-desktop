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
import FollowUpSuggestions from "./FollowUpSuggestions";
import { generateAcademicPrompt } from "./AcademicPrompts";
import FocusMode from "./FocusMode";
import { focusModes } from "./FocusModeConfig";

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
  onNewChat?: (chatId: string, model: string) => void;
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
  const [isDark, setIsDark] = createSignal(true);
  const [instanceId] = createSignal(crypto.randomUUID());

  const [modelParams, setModelParams] = createSignal<ModelParams>({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    max_tokens: 2048,
  });

  const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
  const [searchMode, setSearchMode] = createSignal<string>("");
  const [followUps, setFollowUps] = createSignal<FollowUpSuggestion[]>([]);
  const [mode, setMode] = createSignal("offline");

  const [showNewChatDialog, setShowNewChatDialog] = createSignal(false);
  const [availableModels, setAvailableModels] = createSignal<
    { name: string }[]
  >([]);
  const [selectedModel, setSelectedModel] = createSignal("");

  const getCurrentMode = () => {
    return focusModes.find((m) => m.id === mode()) || focusModes[0];
  };

  const isWebSearchEnabled = () => {
    return getCurrentMode().capabilities.webSearch;
  };

  createEffect(() => {
    // Update search mode based on focus mode capabilities
    if (!isWebSearchEnabled()) {
      setSearchMode("");
    } else if (searchMode() === "") {
      setSearchMode("general");
    }
  });

  const getCurrentSystemPrompt = () => {
    return getCurrentMode().systemPrompt;
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
      await listen<ChatResponse>(`chat-response-${instanceId()}`, (event) => {
        if (event.payload.message.content) {
          setCurrentResponse((prev) => prev + event.payload.message.content);
          scrollToBottom();
        }
      })
    );

    unlisteners.push(
      await listen<ChatResponse>(`chat-complete-${instanceId()}`, (event) => {
        const response = event.payload;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.message.content,
            isPinned: false,
          },
        ]);
        setCurrentResponse("");
        setIsGenerating(false);
        if (response.follow_ups) {
          setFollowUps(response.follow_ups);
        }
        scrollToBottom();
      })
    );

    unlisteners.push(
      await listen(`chat-cancelled-${instanceId()}`, () => {
        setIsGenerating(false);
        if (currentResponse()) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: currentResponse(),
              isPinned: false,
            },
          ]);
          setCurrentResponse("");
        }
      })
    );

    unlisteners.push(
      await listen<any>(`context-update-${instanceId()}`, (event) => {
        // Handle context updates
      })
    );

    onCleanup(() => {
      unlisteners.forEach((unlisten) => unlisten());
    });

    if (props.chatId) {
      try {
        const chatMessages = await invoke<ChatMessage[]>("get_chat_messages", {
          chatId: props.chatId,
        });
        setMessages(chatMessages);
      } catch (e) {
        console.error("Failed to load chat history:", e);
      }
    }
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

  const sendMessage = async () => {
    const input = currentInput().trim();
    if (!input || isGenerating()) return;

    setCurrentInput("");
    setIsGenerating(true);
    setFollowUps([]);
    setError(undefined);

    const newMessage: ChatMessage = {
      role: "user",
      content: input,
      isPinned: false,
    };

    setMessages((prev) => [...prev, newMessage]);

    try {
      await invoke("chat", {
        model: props.modelName || selectedModel(),
        messages: [...messages(), newMessage],
        params: modelParams(),
        chatId: props.chatId,
        systemPrompt: getCurrentSystemPrompt(),
        systemPromptType: getCurrentMode().id,
        instanceId: instanceId(), // Pass instanceId to backend
      });
    } catch (e) {
      console.error("Failed to send message:", e);
      setError("Failed to send message. Please try again.");
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

  const loadModels = async () => {
    try {
      const models = await invoke<{ name: string }[]>("list_models");
      setAvailableModels(models);
    } catch (e) {
      setError(`Failed to load models: ${e}`);
    }
  };

  const startNewChat = async () => {
    try {
      console.log("Creating new chat with model:", selectedModel());
      const newChat = await invoke<Chat>("create_chat", {
        title: "New Chat",
        model: selectedModel(),
      });

      console.log("Created new chat:", newChat);

      if (!newChat || !newChat.id) {
        throw new Error("Invalid response from create_chat");
      }

      if (props.onNewChat) {
        console.log("Calling onNewChat with:", newChat.id, selectedModel());
        props.onNewChat(newChat.id, selectedModel());
      } else {
        console.warn("onNewChat prop is not provided");
      }

      setMessages([]);
      setCurrentResponse("");
      setError(undefined);
      setFollowUps([]);
      setShowNewChatDialog(false);
    } catch (e) {
      console.error("Failed to create new chat:", e);
      setError(`Failed to create new chat: ${e}`);
      // Keep dialog open on error
    }
  };

  // Load models when dialog opens
  createEffect(() => {
    if (showNewChatDialog()) {
      loadModels().then(() => {
        // Only set initial model if none is selected
        if (!selectedModel() && availableModels().length > 0) {
          setSelectedModel(availableModels()[0].name);
        }
      });
    }
  });

  // Reset selected model when dialog closes
  createEffect(() => {
    if (!showNewChatDialog()) {
      setSelectedModel(props.modelName);
    }
  });

  // Fixed dark mode effect
  createEffect(() => {
    if (isDark()) {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
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

  const handleCancelGeneration = async () => {
    try {
      await invoke("cancel_chat_generation");
    } catch (e) {
      setError(`Failed to cancel generation: ${e}`);
    }
  };

  return (
    <div class="flex flex-col h-full bg-primary dark:bg-primary-dark transition-colors duration-300">
      {/* Header */}
      <div class="sticky top-0 z-10 flex-none px-4 py-3 border-b border-divider dark:border-divider-dark bg-surface/80 dark:bg-surface-dark/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60 dark:supports-[backdrop-filter]:bg-surface-dark/60 transition-all duration-300">
        <div class="flex items-center justify-between max-w-3xl mx-auto">
          <div class="flex items-center gap-3">
            <MessageSquare class="w-5 h-5 text-accent dark:text-accent-dark transition-colors" />
            <h2 class="font-medium text-text dark:text-text-dark transition-colors">
              {props.modelName}
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <Button.Root
              onClick={() => setShowNewChatDialog(true)}
              class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MessageSquare class="w-4 h-4 mr-2" />
              New Chat
            </Button.Root>
            <Button.Root
              onClick={() => setIsDark(!isDark())}
              class="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-hover dark:hover:bg-hover-dark rounded-full transition-all duration-300"
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
                onClick={() => setShowSettings(!showSettings())}
                class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
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
                <ChatSettings
                  modelParams={modelParams()}
                  onParamsChange={setModelParams}
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
              <div class="py-8 first:pt-8 border-b border-divider dark:border-divider-dark transition-colors duration-300 animate-messageIn">
                <div class="flex gap-6 items-start">
                  <div class="flex flex-col items-center gap-3">
                    <div
                      class={`flex-none p-3 rounded-xl shadow-sm transition-colors duration-300 ${
                        message.role === "user"
                          ? "bg-user dark:bg-user-dark"
                          : "bg-assistant dark:bg-assistant-dark"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User class="w-5 h-5 text-text-dark dark:text-text" />
                      ) : (
                        <Bot class="w-5 h-5 text-text-dark dark:text-text" />
                      )}
                    </div>
                    {message.systemPromptType && (
                      <div class="text-xs px-3 py-1.5 rounded-lg bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark transition-colors duration-300 border border-divider dark:border-divider-dark">
                        {message.systemPromptType}
                      </div>
                    )}
                  </div>
                  <div class="flex-1 min-w-0 space-y-2">
                    <div class="text-sm text-text-secondary dark:text-text-secondary-dark">
                      {message.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div
                      class={`prose dark:prose-invert max-w-none transition-colors duration-300 ${
                        message.role === "user"
                          ? "text-text dark:text-text-dark"
                          : "text-text dark:text-text-dark"
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

          {/* Show current response in message style */}
          {currentResponse() && (
            <div class="py-8 border-b border-divider dark:border-divider-dark transition-colors duration-300 animate-messageIn">
              <div class="flex gap-6 items-start">
                <div class="flex-none p-3 rounded-xl shadow-sm bg-assistant dark:bg-assistant-dark transition-colors duration-300">
                  <Bot class="w-5 h-5 text-text-dark dark:text-text" />
                </div>
                <div class="flex-1 min-w-0 space-y-2">
                  <div class="text-sm text-text-secondary dark:text-text-secondary-dark">
                    Assistant
                  </div>
                  <div class="prose dark:prose-invert max-w-none text-text dark:text-text-dark">
                    <MessageContent content={currentResponse()} />
                  </div>
                </div>
              </div>
            </div>
          )}

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
      <div class="flex-none border-t border-divider dark:border-divider-dark bg-surface/80 dark:bg-surface-dark/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60 dark:supports-[backdrop-filter]:bg-surface-dark/60 transition-all duration-300">
        <form
          onSubmit={(e) => e.preventDefault()}
          class="max-w-3xl mx-auto p-4"
        >
          <div class="relative flex items-center gap-2 min-h-[48px]">
            <div class="flex-none z-[1]">
              <FocusMode
                mode={mode()}
                onModeChange={(newMode) => {
                  console.log("Focus mode changed:", newMode);
                  setMode(newMode);
                }}
              />
            </div>
            <input
              type="text"
              value={currentInput()}
              onInput={(e) => {
                console.log("Input changed:", e.currentTarget.value);
                setCurrentInput(e.currentTarget.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isGenerating() && currentInput().trim()) {
                    sendMessage();
                  }
                }
              }}
              onFocus={() => console.log("Input focused")}
              placeholder="Type your message..."
              class="chat-input flex-1 min-h-[48px] px-4 py-3 bg-input dark:bg-input-dark rounded-xl border border-divider dark:border-divider-dark focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark z-[2] text-text dark:text-text-dark !text-base !font-normal transition-all duration-300"
            />
            <Button.Root
              type="button"
              onClick={isGenerating() ? handleCancelGeneration : sendMessage}
              disabled={!currentInput().trim() && !isGenerating()}
              class="flex-none p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white
                     disabled:opacity-50 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-300
                     transition-colors rounded-lg z-[1]"
            >
              <Show
                when={!isGenerating()}
                fallback={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <rect x="5" y="5" width="10" height="10" />
                  </svg>
                }
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

      {/* New Chat Dialog */}
      <Show when={showNewChatDialog()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h2 class="text-lg font-semibold mb-4">Start New Chat</h2>
            <div class="mb-4">
              <label class="block text-sm font-medium mb-2">Select Model</label>
              <select
                value={selectedModel()}
                onChange={(e) => {
                  console.log("Selected model:", e.currentTarget.value);
                  setSelectedModel(e.currentTarget.value);
                }}
                class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <For each={availableModels()}>
                  {(model) => (
                    <option
                      value={model.name}
                      selected={model.name === selectedModel()}
                    >
                      {model.name}
                    </option>
                  )}
                </For>
              </select>
            </div>
            <div class="flex justify-end space-x-2">
              <Button.Root
                onClick={() => setShowNewChatDialog(false)}
                class="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </Button.Root>
              <Button.Root
                onClick={startNewChat}
                class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Create
              </Button.Root>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
