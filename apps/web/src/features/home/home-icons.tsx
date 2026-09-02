import type { ReactNode } from "react";

type HomeIconName =
  | "apps"
  | "arrowRight"
  | "bell"
  | "chevronLeft"
  | "chevronRight"
  | "export"
  | "help"
  | "import"
  | "layers"
  | "projects"
  | "settings";

type HomeIconProps = { name: HomeIconName; title?: string };

const iconPaths: Record<HomeIconName, ReactNode> = {
  apps: <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />,
  arrowRight: <path d="M5 12h13M14 7l5 5-5 5" />,
  bell: <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  chevronRight: <path d="m10 6 6 6-6 6" />,
  export: <path d="M12 3v12m0-12-4 4m4-4 4 4M5 13v6h14v-6" />,
  help: (
    <path d="M9.1 9a3 3 0 1 1 5.8 1c-.9 1.2-2.9 1.8-2.9 4M12 18h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  ),
  import: <path d="M12 21V9m0 12-4-4m4 4 4-4M5 11V5h14v6" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5" />,
  projects: <path d="M4 6h6l2 2h8v10H4z" />,
  settings: (
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.4 2.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.4-2.4.1-.1A1.7 1.7 0 0 0 6 15a1.7 1.7 0 0 0-1.5-1H4.3v-3.4h.2A1.7 1.7 0 0 0 6 9.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1L8 5.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.4 2.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1Z" />
  ),
};

export function HomeIcon({ name, title }: HomeIconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="home-icon"
      fill="none"
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {title && <title>{title}</title>}
      {iconPaths[name]}
    </svg>
  );
}
