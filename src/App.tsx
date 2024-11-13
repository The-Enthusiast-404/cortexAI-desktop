import { createSignal, Show } from "solid-js";
import ModelList from "./ModelList";
import ModelPuller from "./ModelPuller";
import Chat from "./Chat";
import "./index.css";

function App() {
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [selectedModel, setSelectedModel] = createSignal<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);

  const handleModelPulled = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
  };

  return (
    <div class="h-screen flex">
      {/* Sidebar */}
      <div
        class={`bg-gray-50 border-r w-80 flex flex-col h-full transition-transform duration-300 ${
          isSidebarOpen() ? "translate-x-0" : "-translate-x-80"
        }`}
      >
        {/* Sidebar Header */}
        <div class="p-4 border-b bg-white">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-xl font-bold">CortexAI</h1>
            <button
              onClick={() => setIsSidebarOpen(false)}
              class="lg:hidden p-2 hover:bg-gray-100 rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                />
              </svg>
            </button>
          </div>
          <ModelPuller onModelPulled={handleModelPulled} />
        </div>

        {/* Model List */}
        <div class="flex-1 overflow-y-auto">
          <ModelList key={refreshTrigger()} onModelSelect={handleModelSelect} />
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 flex flex-col h-full">
        {/* Mobile Header */}
        <div class="lg:hidden p-4 border-b bg-white">
          <button
            onClick={() => setIsSidebarOpen(true)}
            class="p-2 hover:bg-gray-100 rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              />
            </svg>
          </button>
        </div>

        {/* Chat Area */}
        <div class="flex-1 p-4 bg-gray-50">
          <Show
            when={selectedModel()}
            fallback={
              <div class="h-full flex items-center justify-center">
                <div class="text-center p-8 bg-white rounded-lg shadow-sm">
                  <svg
                    class="w-16 h-16 mx-auto mb-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <h2 class="text-xl font-semibold mb-2">No Model Selected</h2>
                  <p class="text-gray-500">
                    Select a model from the sidebar to start chatting
                  </p>
                </div>
              </div>
            }
          >
            <Chat modelName={selectedModel()!} />
          </Show>
        </div>
      </div>
    </div>
  );
}

export default App;
