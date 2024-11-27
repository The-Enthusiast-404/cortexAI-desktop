import { For } from "solid-js";
import { Pin, PinOff } from "lucide-solid";

interface MessageContentProps {
  content: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  showPinControls?: boolean;
}

export default function MessageContent(props: MessageContentProps) {
  // Helper function to process inline markdown
  const processInlineMarkdown = (text: string) => {
    // Process bold text
    text = text.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-bold">$1</strong>'
    );

    // Process italic text
    text = text.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Process inline code
    text = text.replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-surface-secondary dark:bg-surface-secondary-dark text-text dark:text-text-dark text-sm font-mono border border-divider dark:border-divider-dark">$1</code>'
    );

    return text;
  };

  // Helper function to process headings
  const processHeadings = (text: string) => {
    const lines = text.split("\n");
    return lines
      .map((line) => {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const content = headingMatch[2];
          const sizes = {
            1: "text-2xl font-bold",
            2: "text-xl font-bold",
            3: "text-lg font-bold",
            4: "text-base font-bold",
            5: "text-sm font-bold",
            6: "text-xs font-bold",
          };
          return `<h${level} class="${
            sizes[level as keyof typeof sizes]
          } text-text dark:text-text-dark my-3">${content}</h${level}>`;
        }
        return line;
      })
      .join("\n");
  };

  const parseContent = (content: string) => {
    // Split content into blocks based on code blocks first
    const blocks = content.split(/```(\w+)?\n([\s\S]*?)```/).filter(Boolean);

    const parsedBlocks = [];
    let isCode = false;
    let language = "";

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].match(/^[a-zA-Z]+$/)) {
        language = blocks[i];
        isCode = true;
        continue;
      }

      if (isCode) {
        parsedBlocks.push({
          type: "code",
          content: blocks[i],
          language,
        });
        isCode = false;
      } else {
        const textContent = blocks[i];
        const lines = textContent.split("\n");
        let currentList: string[] = [];
        let currentText: string[] = [];

        lines.forEach((line, index) => {
          if (line.trim().match(/^[-*•]\s/)) {
            if (currentText.length) {
              parsedBlocks.push({
                type: "text",
                content: processHeadings(
                  processInlineMarkdown(currentText.join("\n"))
                ),
              });
              currentText = [];
            }
            currentList.push(line.trim());
          } else if (line.trim().match(/^\d+\.\s/)) {
            if (currentText.length) {
              parsedBlocks.push({
                type: "text",
                content: processHeadings(
                  processInlineMarkdown(currentText.join("\n"))
                ),
              });
              currentText = [];
            }
            currentList.push(line.trim());
          } else {
            if (currentList.length) {
              parsedBlocks.push({
                type: "list",
                content: currentList.map((item) => processInlineMarkdown(item)),
              });
              currentList = [];
            }
            currentText.push(line);
          }

          if (index === lines.length - 1 && currentText.length) {
            parsedBlocks.push({
              type: "text",
              content: processHeadings(
                processInlineMarkdown(currentText.join("\n"))
              ),
            });
          }
        });

        if (currentList.length) {
          parsedBlocks.push({
            type: "list",
            content: currentList.map((item) => processInlineMarkdown(item)),
          });
        }
      }
    }

    return parsedBlocks;
  };

  return (
    <div class="relative group">
      <div class="space-y-4">
        <For each={parseContent(props.content)}>
          {(block) => {
            if (block.type === "code") {
              return (
                <div class="relative">
                  <pre class="rounded-lg bg-surface-secondary dark:bg-surface-secondary-dark p-4 overflow-x-auto border border-divider dark:border-divider-dark">
                    <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(block.content);
                        }}
                        class="p-1 hover:bg-surface-dark dark:hover:bg-surface rounded transition-colors"
                        title="Copy code"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="text-text-secondary dark:text-text-secondary-dark"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                    <code class="text-sm font-mono text-text dark:text-text-dark">
                      {block.content}
                    </code>
                  </pre>
                </div>
              );
            } else if (block.type === "list") {
              return (
                <ul class="list-disc list-inside space-y-1 text-text dark:text-text-dark">
                  <For each={block.content}>
                    {(item) => (
                      <li
                        class="pl-2"
                        innerHTML={processInlineMarkdown(item)}
                      />
                    )}
                  </For>
                </ul>
              );
            } else {
              return (
                <div
                  class="text-text dark:text-text-dark leading-relaxed"
                  innerHTML={block.content}
                />
              );
            }
          }}
        </For>
      </div>
      {props.showPinControls && (
        <button
          onClick={props.onTogglePin}
          class="absolute -left-12 top-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark"
          title={props.isPinned ? "Unpin message" : "Pin message"}
        >
          {props.isPinned ? (
            <PinOff class="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
          ) : (
            <Pin class="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
          )}
        </button>
      )}
    </div>
  );
}
