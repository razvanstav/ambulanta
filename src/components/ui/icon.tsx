import type { SVGProps } from "react";

const paths = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  box: "m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v8M7.5 5.5l9 5",
  file: "M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h6",
  clipboard: "M9 4H5v18h14V4h-4M9 2h6v5H9zM8 12h8M8 16h5",
  check: "m5 12 4 4L19 6",
  circleCheck: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  ambulance:
    "M16 17H8M4 17H2V5h13v12M15 9h4l3 4v4h-2M6 5v6M3 8h6M8 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  settings: "M4 7h16M4 17h16M9 4v6M15 14v6",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
  calendar: "M3 5h18v17H3zM7 2v6M17 2v6M3 11h18M7 15h3M14 15h3",
  warning: "m12 3 10 18H2L12 3ZM12 9v5M12 17v.1",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6M12 7v.1",
  search: "M21 21l-6-6M17 9A8 8 0 1 1 1 9a8 8 0 0 1 16 0Z",
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "m6 6 12 12M6 18 18 6",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-5 10 3 3 7-7",
  pulse: "M1 12h5l3-9 4 18 3-9h7",
  filter: "M3 5h18M6 12h12M10 19h4",
  refresh: "M20 7a9 9 0 1 0 1 9M20 2v6h-6",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
