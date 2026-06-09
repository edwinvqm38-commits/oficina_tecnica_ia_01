// Icon set — 16×16 viewBox, 1.5px stroke, rounded caps/joins
// Ported from the IA Gerencial design prototype (ig-icons.jsx)
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  dashboard: (p: IconProps) => (
    <Base {...p}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
    </Base>
  ),
  office: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="2.5" r="1.5" />
      <circle cx="2.5" cy="11" r="1.5" />
      <circle cx="13.5" cy="11" r="1.5" />
      <line x1="8" y1="4" x2="8" y2="6.5" />
      <line x1="8" y1="6.5" x2="2.5" y2="9.5" />
      <line x1="8" y1="6.5" x2="13.5" y2="9.5" />
      <rect x="5.5" y="6.5" width="5" height="4" rx="1" />
    </Base>
  ),
  inbox: (p: IconProps) => (
    <Base {...p}>
      <path d="M1.5 10L4.5 10L6 12.5H10L11.5 10H14.5" />
      <path d="M1.5 3.5h13v10a1 1 0 01-1 1h-11a1 1 0 01-1-1V3.5z" />
      <line x1="8" y1="6" x2="8" y2="9.5" />
      <polyline points="6,7.5 8,9.5 10,7.5" />
    </Base>
  ),
  approvals: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <polyline points="5,8.2 7,10.5 11,5.5" />
    </Base>
  ),
  projects: (p: IconProps) => (
    <Base {...p}>
      <rect x="1.5" y="4.5" width="13" height="10" rx="1.5" />
      <path d="M5.5 4.5V3a1 1 0 011-1h3a1 1 0 011 1v1.5" />
      <line x1="1.5" y1="8.5" x2="14.5" y2="8.5" />
    </Base>
  ),
  pmo: (p: IconProps) => (
    <Base {...p}>
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
      <line x1="5" y1="1" x2="5" y2="4" />
      <line x1="11" y1="1" x2="11" y2="4" />
      <line x1="1.5" y1="7" x2="14.5" y2="7" />
      <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    </Base>
  ),
  costs: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5v7" />
      <path d="M5.5 6.5a2.5 1.5 0 015 0 2.5 1.5 0 01-5 0z" />
      <line x1="5.5" y1="10" x2="10.5" y2="10" />
    </Base>
  ),
  engineering: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" />
      <path d="M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </Base>
  ),
  agents: (p: IconProps) => (
    <Base {...p}>
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M13 10c1.5.5 2.5 2 2.5 3.5" />
    </Base>
  ),
  skills: (p: IconProps) => (
    <Base {...p}>
      <path d="M8 1.5l1.5 4h4l-3.2 2.5 1.5 4.5L8 10.2l-3.8 2.3 1.5-4.5L2.5 5.5h4z" />
    </Base>
  ),
  memory: (p: IconProps) => (
    <Base {...p}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <line x1="4.5" y1="5.5" x2="11.5" y2="5.5" />
      <line x1="4.5" y1="8" x2="11.5" y2="8" />
      <line x1="4.5" y1="10.5" x2="8" y2="10.5" />
    </Base>
  ),
  settings: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
    </Base>
  ),
  chevronDown: (p: IconProps) => (
    <Base {...p}>
      <polyline points="4,6 8,10 12,6" />
    </Base>
  ),
  chevronRight: (p: IconProps) => (
    <Base {...p}>
      <polyline points="6,4 10,8 6,12" />
    </Base>
  ),
  chevronUp: (p: IconProps) => (
    <Base {...p}>
      <polyline points="4,10 8,6 12,10" />
    </Base>
  ),
  alert: (p: IconProps) => (
    <Base {...p}>
      <path d="M8 1.5L14.5 13.5H1.5L8 1.5z" />
      <line x1="8" y1="6" x2="8" y2="9.5" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
    </Base>
  ),
  bell: (p: IconProps) => (
    <Base {...p}>
      <path d="M8 2a4.5 4.5 0 00-4.5 4.5v2.5l-1 2h11l-1-2V6.5A4.5 4.5 0 008 2z" />
      <path d="M6.5 13.5a1.5 1.5 0 003 0" />
    </Base>
  ),
  check: (p: IconProps) => (
    <Base strokeWidth={2} {...p}>
      <polyline points="3,8.5 6.5,12 13,4" />
    </Base>
  ),
  x: (p: IconProps) => (
    <Base strokeWidth={2} {...p}>
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </Base>
  ),
  eye: (p: IconProps) => (
    <Base {...p}>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </Base>
  ),
  arrowRight: (p: IconProps) => (
    <Base {...p}>
      <line x1="2" y1="8" x2="14" y2="8" />
      <polyline points="10,4.5 14,8 10,11.5" />
    </Base>
  ),
  shield: (p: IconProps) => (
    <Base {...p}>
      <path d="M8 1.5L2 4v4c0 3.3 2.7 5.7 6 6.5 3.3-.8 6-3.2 6-6.5V4L8 1.5z" />
    </Base>
  ),
  sparkle: (p: IconProps) => (
    <Base {...p}>
      <path d="M8 2v12M2 8h12M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" strokeWidth={1.25} />
    </Base>
  ),
  link: (p: IconProps) => (
    <Base {...p}>
      <path d="M9.5 6.5a3 3 0 014.2 4.2l-1.5 1.5a3 3 0 01-4.2-4.2" />
      <path d="M6.5 9.5a3 3 0 01-4.2-4.2L3.8 3.8a3 3 0 014.2 4.2" />
    </Base>
  ),
  folder: (p: IconProps) => (
    <Base {...p}>
      <path d="M1.5 4.5h4l1.5 2h7a1 1 0 011 1V13a1 1 0 01-1 1h-12a1 1 0 01-1-1V5.5a1 1 0 011-1z" />
    </Base>
  ),
  clock: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <polyline points="8,4.5 8,8 10.5,10.5" />
    </Base>
  ),
  user: (p: IconProps) => (
    <Base {...p}>
      <circle cx="8" cy="5.5" r="3" />
      <path d="M2 14.5c0-3.3 2.7-5 6-5s6 1.7 6 5" />
    </Base>
  ),
  layers: (p: IconProps) => (
    <Base {...p}>
      <polyline points="1.5,8 8,4.5 14.5,8" />
      <polyline points="1.5,11 8,7.5 14.5,11" />
      <polyline points="1.5,5 8,1.5 14.5,5" />
    </Base>
  ),
  paperclip: (p: IconProps) => (
    <Base {...p}>
      <path d="M13.5 7L7 13.5a4 4 0 01-5.7-5.7l7-7a2.5 2.5 0 013.5 3.5L5 11a1 1 0 01-1.4-1.4L9.5 4" />
    </Base>
  ),
} satisfies Record<string, (p: IconProps) => React.ReactElement>;

export type IconName = keyof typeof Icons;
