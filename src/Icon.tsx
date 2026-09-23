import type { ReactElement, SVGProps } from "react";

type IconName =
  | "arrow-left"
  | "plus"
  | "reorder"
  | "more"
  | "dumbbell"
  | "settings"
  | "play"
  | "stop"
  | "trash"
  | "chevron-up"
  | "chevron-down"
  | "home"
  | "nutrition"
  | "check"
  | "circle"
  | "list"
  | "calendar"
  | "performance"
  | "trophy"
  | "edit"
  | "file-text"
  | "chevron-right";

const paths: Record<IconName, ReactElement> = {
  "arrow-left": <path d="m15 18-6-6 6-6" />,
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  reorder: (
    <>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6 9v6M9 7v10M15 7v10M18 9v6M9 12h6" />
      <path d="M3 10v4M21 10v4" />
    </>
  ),
  settings: (
    <>
      <path d="m12 3 1.3 1.8 2.2.5.5 2.2L18 9l-.9 2 .9 2-2 1.5-.5 2.2-2.2.5L12 19l-1.3-1.8-2.2-.5-.5-2.2L6 13l.9-2L6 9l2-1.5.5-2.2 2.2-.5L12 3Z" />
      <circle cx="12" cy="11" r="2.5" />
    </>
  ),
  play: <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />,
  stop: (
    <rect
      x="7"
      y="7"
      width="10"
      height="10"
      rx="1"
      fill="currentColor"
      stroke="none"
    />
  ),
  trash: (
    <>
      <path d="M5 7h14M10 4h4M8 7l1 13h6l1-13M10 10v7M14 10v7" />
    </>
  ),
  "chevron-up": <path d="m6 14 6-6 6 6" />,
  "chevron-down": <path d="m6 10 6 6 6-6" />,
  home: (
    <>
      <path d="m4 11 8-7 8 7v8H4v-8Z" />
      <path d="M9 19v-5h6v5" />
    </>
  ),
  nutrition: (
    <>
      <path d="M12 7c-1.8-2-5.7-1.7-7.1 1.5-1.8 4.1 1.8 10.7 5.2 11.4.7.1 1.3-.3 1.9-.3s1.2.4 1.9.3c3.4-.7 7-7.3 5.2-11.4C17.7 5.3 13.8 5 12 7Z" />
      <path d="M12 6c.1-2.4 1.5-3.7 3.9-3.9M12.1 5.5c-1.8.1-3-.7-3.7-2.2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  circle: <circle cx="12" cy="12" r="8" />,
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  performance: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
      <path d="m3 14 7-6 6 2 6-6" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4c0 4-1.8 6-4 6s-4-2-4-6V4Z" />
      <path d="M8 6H4v2c0 2.2 1.6 4 4 4M16 6h4v2c0 2.2-1.6 4-4 4M12 14v4M8 21h8M9 18h6" />
    </>
  ),
  edit: (
    <>
      <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" />
      <path d="m13.5 7 3.5 3.5" />
    </>
  ),
  "file-text": (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h6M9 16h6" />
    </>
  ),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  ...props
}: { name: IconName; size?: number; strokeWidth?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "name"
>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
