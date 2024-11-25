import { Component, Show } from "solid-js";

interface CustomLinkProps {
  href: string;
  title?: string;
}

const CustomLink: Component<CustomLinkProps> = (props) => {
  const url = new URL(props.href);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;

  return (
    <div class="flex items-center space-x-2 my-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <img
        src={faviconUrl}
        alt={url.hostname}
        class="w-4 h-4"
        onError={(e) => {
          e.currentTarget.src =
            "https://www.google.com/s2/favicons?domain=default&sz=32";
        }}
      />
      <div class="flex flex-col min-w-0">
        <Show when={props.title}>
          <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {props.title}
          </span>
        </Show>
        <a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
        >
          {url.hostname}
          {url.pathname}
        </a>
      </div>
    </div>
  );
};

export default CustomLink;
