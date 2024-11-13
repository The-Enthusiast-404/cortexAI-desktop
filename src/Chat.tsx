import { createSignal, createEffect, For, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import MessageContent from "./MessageContent";

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
    let unlisten: (() => void) | undefined;

    async function setupListener() {
      unlisten = await listen<ChatResponse>("chat-response", (event) => {
        const response = event.payload;

        if (!response.done) {
          setCurrentResponse((prev) => prev + response.message.content);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: currentResponse() },
          ]);
          setCurrentResponse("");
          setIsGenerating(false);
        }
      });
    }

    setupListener();

    onCleanup(() => {
      if (unlisten) {
        unlisten();
      }
    });
  });

  const sendMessage = async (e: Event) => {
    e.preventDefault();
    const userInput = currentInput().trim();

    if (!userInput || isGenerating()) return;

    const userMessage = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    setIsGenerating(true);

    try {
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

  const messagesEndRef = () => {
    const div = document.createElement("div");
    div.id = "messages-end";
    return div;
  };

  createEffect(() => {
    // Scroll to bottom when messages change
    const endDiv = document.getElementById("messages-end");
    if (endDiv) {
      endDiv.scrollIntoView({ behavior: "smooth" });
    }
  });

  return (
    <div class="h-full flex flex-col bg-white">
      {/* Chat header */}
      <div class="flex-none p-4 border-b hidden lg:block">
        <h2 class="font-semibold text-gray-800">Chat with {props.modelName}</h2>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <For each={messages()}>
          {(message) => (
            <div
              class={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                class={`max-w-[80%] rounded-lg p-4 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100"
                }`}
              >
                <MessageContent content={message.content} />
              </div>
            </div>
          )}
        </For>

        {/* Streaming response */}
        {currentResponse() && (
          <div class="flex justify-start">
            <div class="max-w-[80%] rounded-lg p-4 bg-gray-100">
              <MessageContent content={currentResponse()} />
            </div>
          </div>
        )}
        {/* Scroll anchor */}
        {messagesEndRef()}
      </div>

      {/* Input form */}
      <div class="flex-none border-t p-4">
        <form onSubmit={sendMessage} class="flex space-x-4">
          <input
            type="text"
            value={currentInput()}
            onInput={(e) => setCurrentInput(e.currentTarget.value)}
            placeholder="Type your message..."
            class="flex-1 p-2 border rounded-md focus:outline-none focus:border-blue-500"
            disabled={isGenerating()}
          />
          <button
            type="submit"
            disabled={isGenerating()}
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:hover:bg-blue-500"
          >
            {isGenerating() ? "Generating..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
