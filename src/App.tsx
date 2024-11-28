import { createSignal } from "solid-js";
import ModelList from "./ModelList";
import ModelPuller from "./ModelPuller";
import TabManager from "./TabManager";
import ChatHistory from "./ChatHistory";
import "./index.css";
import { invoke } from "@tauri-apps/api/core";

interface Chat {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [selectedModel, setSelectedModel] = createSignal<string | null>(null);
  const [selectedChatId, setSelectedChatId] = createSignal<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [showModelList, setShowModelList] = createSignal(true);

  const handleModelPulled = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleChatSelect = (chatId: string, model: string) => {
    setSelectedModel(model);
    setSelectedChatId(chatId);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleModelSelect = async (modelName: string) => {
    try {
      // Create a new chat with the selected model
      const newChat = await invoke<Chat>("create_chat", {
        title: "New Chat",
        model: modelName,
      });

      if (!newChat || !newChat.id) {
        throw new Error("Invalid response from create_chat");
      }

      // Update state with the new chat
      setSelectedModel(modelName);
      setSelectedChatId(newChat.id);
      setShowModelList(false); // Switch to chats tab

      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  const handleNewChat = (chatId: string, model: string) => {
    setSelectedChatId(chatId);
    setSelectedModel(model);
    setShowModelList(false); // Switch to chats tab
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteChat = () => {
    setSelectedChatId(null);
    setSelectedModel(null);
  };

  return (
    <div class="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div
        class={`fixed lg:relative z-30 w-80 flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm
                transition-transform duration-300
                ${
                  isSidebarOpen()
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                }`}
      >
        {/* Sidebar Header */}
        <div class="flex-none border-b border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              CortexAI Desktop
            </h1>
            <button
              onClick={() => setIsSidebarOpen(false)}
              class="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-gray-500 dark:text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div class="flex space-x-2 mb-4">
            <button
              onClick={() => setShowModelList(true)}
              class={`flex-1 py-2 px-4 rounded-md ${
                showModelList()
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Models
            </button>
            <button
              onClick={() => setShowModelList(false)}
              class={`flex-1 py-2 px-4 rounded-md ${
                !showModelList()
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Chats
            </button>
          </div>

          {/* Show ModelPuller only in Models tab */}
          {showModelList() && <ModelPuller onModelPulled={handleModelPulled} />}
        </div>

        {/* Sidebar Content */}
        <div class="flex-1 overflow-y-auto">
          {showModelList() ? (
            <ModelList
              key={refreshTrigger()}
              onModelSelect={handleModelSelect}
              selectedModel={selectedModel()}
            />
          ) : (
            <ChatHistory
              onChatSelect={handleChatSelect}
              selectedChatId={selectedChatId()}
              onDeleteChat={handleDeleteChat}
            />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div class="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <div class="lg:hidden flex-none h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center px-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-gray-500 dark:text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Tab Manager - Give it full height minus mobile header */}
        <div class="flex-1 h-[calc(100vh-4rem)] lg:h-screen">
          <TabManager />
        </div>
      </div>
    </div>
  );
}
