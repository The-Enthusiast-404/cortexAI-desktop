import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import { Plus, X } from "lucide-solid";
import Chat from "./Chat";

interface Tab {
  id: string;
  title: string;
  modelName: string;
  chatId: string | null;
  isActive: boolean;
}

// Local storage key for tabs
const TABS_STORAGE_KEY = "cortexai-tabs";
const ACTIVE_TAB_KEY = "cortexai-active-tab";

export default function TabManager() {
  const [tabs, setTabs] = createSignal<Tab[]>([]);
  const [activeTabId, setActiveTabId] = createSignal<string | null>(null);

  // Save tabs to local storage whenever they change
  createEffect(() => {
    const currentTabs = tabs();
    if (currentTabs.length > 0) {
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(currentTabs));
    }
  });

  // Save active tab whenever it changes
  createEffect(() => {
    const currentActiveTab = activeTabId();
    if (currentActiveTab) {
      localStorage.setItem(ACTIVE_TAB_KEY, currentActiveTab);
    }
  });

  // Load saved tabs on mount
  onMount(() => {
    const savedTabs = localStorage.getItem(TABS_STORAGE_KEY);
    const savedActiveTab = localStorage.getItem(ACTIVE_TAB_KEY);

    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs) as Tab[];
        setTabs(parsedTabs);

        // Restore active tab if it exists in the saved tabs
        if (
          savedActiveTab &&
          parsedTabs.some((tab) => tab.id === savedActiveTab)
        ) {
          setActiveTabId(savedActiveTab);
        } else if (parsedTabs.length > 0) {
          setActiveTabId(parsedTabs[0].id);
        }
      } catch (e) {
        console.error("Failed to restore tabs:", e);
        createNewTab(); // Create a new tab if restoration fails
      }
    } else {
      createNewTab(); // Create a new tab if no saved tabs
    }
  });

  const createNewTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      title: "New Chat",
      modelName: "",
      chatId: null,
      isActive: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);
      // If we're removing the last tab, clear local storage
      if (newTabs.length === 0) {
        localStorage.removeItem(TABS_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_TAB_KEY);
      }
      return newTabs;
    });

    if (activeTabId() === tabId) {
      const remainingTabs = tabs().filter((tab) => tab.id !== tabId);
      setActiveTabId(
        remainingTabs.length > 0
          ? remainingTabs[remainingTabs.length - 1].id
          : null
      );
    }
  };

  const updateTabTitle = (tabId: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
    );
  };

  const handleNewChat = (chatId: string, model: string, tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, chatId, modelName: model, title: `Chat - ${model}` }
          : tab
      )
    );
  };

  return (
    <div class="flex flex-col h-full">
      {/* Tab Bar */}
      <div class="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2">
        <div class="flex-1 flex items-center overflow-x-auto">
          <For each={tabs()}>
            {(tab) => (
              <div
                class={`flex items-center px-4 py-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer
                  ${
                    activeTabId() === tab.id
                      ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span class="truncate max-w-xs">{tab.title}</span>
                <button
                  class="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            )}
          </For>
        </div>
        <button
          class="flex items-center justify-center p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full mx-2 text-gray-600 dark:text-gray-400"
          onClick={createNewTab}
        >
          <Plus class="w-5 h-5" />
        </button>
      </div>

      {/* Tab Content */}
      <div class="flex-1 overflow-hidden">
        <Show
          when={activeTabId()}
          fallback={
            <div class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div class="text-center">
                <Plus class="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Create a new tab to start chatting</p>
              </div>
            </div>
          }
        >
          <For each={tabs()}>
            {(tab) => (
              <Show when={tab.id === activeTabId()}>
                <Chat
                  modelName={tab.modelName}
                  chatId={tab.chatId}
                  onNewChat={(chatId, model) =>
                    handleNewChat(chatId, model, tab.id)
                  }
                />
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
