import { Component, createSignal, Show } from "solid-js";
import { FiTarget, FiMessageSquare } from "solid-icons/fi";
import { IoBookOutline } from "solid-icons/io";
import { TbWorldWww } from "solid-icons/tb";

interface FocusModeProps {
  mode: string;
  onModeChange: (mode: string) => void;
}

const FocusMode: Component<FocusModeProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);

  const modes = [
    {
      id: "offline",
      name: "Chat",
      icon: FiMessageSquare,
      description: "Default chat mode without web search",
    },
    {
      id: "web",
      name: "Internet",
      icon: TbWorldWww,
      description: "Search and browse the internet",
    },
    {
      id: "academic",
      name: "Academic",
      icon: IoBookOutline,
      description: "Research papers and scholarly content",
    },
  ];

  const getCurrentMode = () => {
    return modes.find((m) => m.id === props.mode) || modes[0];
  };

  return (
    <div class="relative inline-block">
      <Show when={isOpen()}>
        <div class="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-[1]">
          <div class="py-1">
            {modes.map((mode) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onModeChange(mode.id);
                  setIsOpen(false);
                }}
                class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                classList={{
                  "bg-gray-50 dark:bg-gray-800": mode.id === props.mode,
                }}
              >
                <mode.icon class="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {mode.name}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {mode.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Show>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen());
        }}
        class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        classList={{
          "bg-gray-50 dark:bg-gray-800": isOpen(),
          "bg-white dark:bg-gray-900": !isOpen(),
        }}
      >
        <FiTarget class="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span class="hidden sm:inline text-gray-700 dark:text-gray-300">
          {getCurrentMode().name}
        </span>
      </button>
    </div>
  );
};

export default FocusMode;
