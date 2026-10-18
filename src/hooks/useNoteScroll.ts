import { useLayoutEffect, useRef } from "react";
import { isNearBottom, shouldFollowTail } from "@/lib/note-scroll";

export function useNoteScroll(identity: string, tailId: string | null) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  const previous = useRef<string | null>(null);

  useLayoutEffect(() => {
    previous.current = null;
    pinned.current = true;
  }, [identity]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && shouldFollowTail(previous.current, tailId, pinned.current)) {
      el.scrollTop = el.scrollHeight;
      pinned.current = true;
    }
    previous.current = tailId;
  }, [identity, tailId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const observer = new ResizeObserver(() => {
      // Only keep the bottom in view when the person was already there.
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    observer.observe(el);
    return () => observer.disconnect();
  }, [identity]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) pinned.current = isNearBottom(el.scrollTop, el.scrollHeight, el.clientHeight);
  };

  return { scrollRef, contentRef, onScroll };
}