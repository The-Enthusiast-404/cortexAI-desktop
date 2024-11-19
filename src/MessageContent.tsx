import { For } from "solid-js";

interface MessageContentProps {
  content: string;
}

export default function MessageContent(props: MessageContentProps) {
  // Helper function to process inline markdown
  const processInlineMarkdown = (text: string) => {
    // Process bold text
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Process italic text
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Process inline code
    text = text.replace(
      /`([^`]+)`/g,
      '<code class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-0.5 rounded">$1</code>',
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
          return `<h${level} class="${sizes[level as keyof typeof sizes]} text-gray-900 dark:text-white">${content}</h${level}>`;
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
                  processInlineMarkdown(currentText.join("\n")),
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
                  processInlineMarkdown(currentText.join("\n")),
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
                processInlineMarkdown(currentText.join("\n")),
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
    <div class="space-y-4 text-gray-900 dark:text-white">
      <For each={parseContent(props.content)}>
        {(block) => {
          switch (block.type) {
            case "code":
              return (
                <div class="relative group">
                  <pre class="overflow-auto rounded-lg bg-gray-100 dark:bg-gray-800 p-4 text-sm text-gray-900 dark:text-white">
                    <code class={`language-${block.language}`}>
                      {block.content}
                    </code>
                  </pre>
                  <button
                    class="absolute top-2 right-2 p-2 rounded-md bg-gray-200 dark:bg-gray-700
                           text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => navigator.clipboard.writeText(block.content)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                  </button>
                </div>
              );
            case "list":
              return (
                <ul class="list-disc list-inside space-y-1">
                  <For each={block.content}>
                    {(item) => (
                      <li
                        class="text-gray-900 dark:text-white"
                        innerHTML={item.replace(/^[-*•]\s+/, "")}
                      />
                    )}
                  </For>
                </ul>
              );
            default:
              return (
                <div
                  class="whitespace-pre-wrap text-gray-900 dark:text-white"
                  innerHTML={block.content}
                />
              );
          }
        }}
      </For>
    </div>
  );
}
