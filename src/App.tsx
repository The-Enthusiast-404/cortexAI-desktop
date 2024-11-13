import { createSignal, Show } from "solid-js";
import ModelList from "./ModelList";
import ModelPuller from "./ModelPuller";
import Chat from "./Chat";
import "./index.css";

function App() {
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [selectedModel, setSelectedModel] = createSignal<string | null>(null);

  const handleModelPulled = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
  };

  return (
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <h1 class="text-3xl font-bold mb-8 text-center">
        CortexAI - Local LLM Manager
      </h1>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-6">
          <ModelPuller onModelPulled={handleModelPulled} />
          <ModelList key={refreshTrigger()} onModelSelect={handleModelSelect} />
        </div>

        <Show
          when={selectedModel()}
          fallback={
            <div class="p-4 border rounded bg-white shadow-sm text-center text-gray-500">
              Select a model from the list to start chatting
            </div>
          }
        >
          <Chat modelName={selectedModel()!} />
        </Show>
      </div>
    </div>
  );
}

export default App;
