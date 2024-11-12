import { createSignal } from "solid-js";
import ModelList from "./ModelList";
import ModelPuller from "./ModelPuller";
import "./index.css";

function App() {
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);

  const handleModelPulled = () => {
    // Increment the refresh trigger to cause ModelList to refresh
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <main class="container">
      <h1>CortexAI - Local LLM Manager</h1>
      <div class="grid gap-6">
        <ModelPuller onModelPulled={handleModelPulled} />
        <ModelList key={refreshTrigger()} />
      </div>
    </main>
  );
}

export default App;
