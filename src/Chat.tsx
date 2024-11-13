import { createSignal, createEffect, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatResponse {
  message: ChatMessage;
  done: boolean;
}

interface ChatProps {
  modelName: string;
}

export default function Chat(props: ChatProps) {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [currentResponse, setCurrentResponse] = createSignal("");

  // Listen for streaming responses
  createEffect(() => {
    const unlisten = listen<ChatResponse>("chat-response", (event) => {
      const response = event.payload;

      if (!response.done) {
        // Accumulate the response
        setCurrentResponse((prev) => prev + response.message.content);
      } else {
        // When done, add the complete message to the chat
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: currentResponse() },
        ]);
        setCurrentResponse("");
        setIsGenerating(false);
      }
    });

    return () => {
      unlisten.then((f) => f()); // Cleanup listener
    };
  });

  const sendMessage = async (e: Event) => {
    e.preventDefault();
    const userInput = currentInput().trim();

    if (!userInput || isGenerating()) return;

    // Add user message to chat
    const userMessage = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    setIsGenerating(true);

    try {
      // Send chat request to Rust backend
      await invoke("chat", {
        model: props.modelName,
        messages: [...messages(), userMessage],
      });
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error generating the response.",
        },
      ]);
      setIsGenerating(false);
    }
  };

  return (
    <div class="flex flex-col h-[600px] bg-white rounded-lg shadow">
      {/* Chat messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <For each={messages()}>
          {(message) => (
            <div
              class={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                class={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {message.content}
              </div>
            </div>
          )}
        </For>

        {/* Streaming response */}
        {currentResponse() && (
          <div class="flex justify-start">
            <div class="max-w-[80%] rounded-lg p-3 bg-gray-100 text-gray-800">
              {currentResponse()}
            </div>
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={sendMessage} class="p-4 border-t">
        <div class="flex space-x-4">
          <input
            type="text"
            value={currentInput()}
            onInput={(e) => setCurrentInput(e.currentTarget.value)}
            placeholder="Type your message..."
            class="flex-1 p-2 border rounded"
            disabled={isGenerating()}
          />
          <button
            type="submit"
            disabled={isGenerating()}
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isGenerating() ? "Generating..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
