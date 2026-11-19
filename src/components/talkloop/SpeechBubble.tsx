import type { SVGProps } from "react";

/** Simple round speech bubble icon (matches the lucide stroke style). */
export function SpeechBubble(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

/** Two overlapping speech bubbles for groups. */
export function SpeechBubbles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6.2 14.5A6.5 6.5 0 1 1 9.5 16.4L5 18Z" />
      <path d="M16.9 8.6A6.5 6.5 0 0 1 18.6 19l1.4 3.5-4.3-1.6a6.5 6.5 0 0 1-5.1-1.2" />
    </svg>
  );
}
