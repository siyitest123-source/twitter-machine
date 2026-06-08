/**
 * Icons.tsx — clean line icon set (stroke 1.6, currentColor).
 * Ported 1:1 from the prototype's icons.jsx with TS types.
 */
import type { SVGProps } from "react";

// Omit the native SVG `stroke` (which is a color string) so we can repurpose
// the same prop name for strokeWidth — matches the prototype's API.
type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke"> & {
  size?: number;
  stroke?: number;
};

function Ic({ size = 18, stroke = 1.6, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (<Ic {...p}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9.5a.5.5 0 0 0 .5.5H10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5h3.5a.5.5 0 0 0 .5-.5V10" /></Ic>);
export const IconCreate = (p: IconProps) => (<Ic {...p}><path d="M12 3.2 13.7 9 19.5 10.7 13.7 12.4 12 18.2 10.3 12.4 4.5 10.7 10.3 9 12 3.2Z" /><path d="M18.5 4.2v3M20 5.7h-3" /></Ic>);
export const IconQueue = (p: IconProps) => (<Ic {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.4" /><path d="M3.5 13h4l1.5 2.2h6L16.5 13h4" /></Ic>);
export const IconCalendar = (p: IconProps) => (<Ic {...p}><rect x="3.8" y="5" width="16.4" height="15" rx="2.4" /><path d="M3.8 9.5h16.4M8 3.5v3M16 3.5v3" /></Ic>);
export const IconChart = (p: IconProps) => (<Ic {...p}><path d="M4 19.5V4.5" /><path d="M4 19.5h16" /><path d="M8 16.5v-4M12.5 16.5v-7M17 16.5v-9.5" /></Ic>);
export const IconVoice = (p: IconProps) => (<Ic {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></Ic>);
export const IconTarget = (p: IconProps) => (<Ic {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></Ic>);
export const IconAccounts = (p: IconProps) => (<Ic {...p}><circle cx="12" cy="8.5" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></Ic>);
export const IconCompass = (p: IconProps) => (<Ic {...p}><circle cx="12" cy="12" r="8.2" /><path d="m14.8 9.2-1.9 4.7-4.7 1.9 1.9-4.7 4.7-1.9Z" /></Ic>);
export const IconSearch = (p: IconProps) => (<Ic {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Ic>);
export const IconCheck = (p: IconProps) => (<Ic {...p}><path d="m4.5 12.5 5 5 10-11" /></Ic>);
export const IconX = (p: IconProps) => (<Ic {...p}><path d="M6 6l12 12M18 6 6 18" /></Ic>);
export const IconCopy = (p: IconProps) => (<Ic {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M5.5 15.5h-.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" /></Ic>);
export const IconEdit = (p: IconProps) => (<Ic {...p}><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Ic>);
export const IconTrash = (p: IconProps) => (<Ic {...p}><path d="M4.5 7h15M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M6.5 7l.8 11.4A1.6 1.6 0 0 0 8.9 20h6.2a1.6 1.6 0 0 0 1.6-1.6L17.5 7" /></Ic>);
export const IconArrow = (p: IconProps) => (<Ic {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Ic>);
export const IconArrowUpRight = (p: IconProps) => (<Ic {...p}><path d="M7 17 17 7M8 7h9v9" /></Ic>);
export const IconChevDown = (p: IconProps) => (<Ic {...p}><path d="m6 9.5 6 6 6-6" /></Ic>);
export const IconChevL = (p: IconProps) => (<Ic {...p}><path d="m14 6-6 6 6 6" /></Ic>);
export const IconChevR = (p: IconProps) => (<Ic {...p}><path d="m10 6 6 6-6 6" /></Ic>);
export const IconPlus = (p: IconProps) => (<Ic {...p}><path d="M12 5v14M5 12h14" /></Ic>);
export const IconSun = (p: IconProps) => (<Ic {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></Ic>);
export const IconMoon = (p: IconProps) => (<Ic {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /></Ic>);
export const IconSettings = (p: IconProps) => (<Ic {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></Ic>);
export const IconThread = (p: IconProps) => (<Ic {...p}><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><path d="M6 8.2v7.6M10 6h8M10 18h8M10 12h6" /></Ic>);
export const IconReply = (p: IconProps) => (<Ic {...p}><path d="M9 7 4 12l5 5" /><path d="M4 12h9a6 6 0 0 1 6 6v1" /></Ic>);
export const IconSparkLine = (p: IconProps) => (<Ic {...p}><path d="M3 15l4-5 4 3 4-7 6 9" /></Ic>);
export const IconClock = (p: IconProps) => (<Ic {...p}><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></Ic>);
export const IconHeart = (p: IconProps) => (<Ic {...p}><path d="M12 19.5 4.8 12.3a4.3 4.3 0 0 1 6-6.1l1.2 1.1 1.2-1.1a4.3 4.3 0 0 1 6 6.1L12 19.5Z" /></Ic>);
export const IconRetweet = (p: IconProps) => (<Ic {...p}><path d="M5 9V7.5A2.5 2.5 0 0 1 7.5 5H16l-2.5-2.5M19 15v1.5a2.5 2.5 0 0 1-2.5 2.5H8l2.5 2.5M16 5l3 3M8 19l-3-3" /></Ic>);
export const IconImpressions = (p: IconProps) => (<Ic {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></Ic>);
