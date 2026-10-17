import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { durationLabel } from "@/lib/talkloop";
import { cn } from "@/lib/utils";

export type MediaItem = { path: string; kind: string; seconds?: number | null };

export function NoteMediaList({ items }: { items: MediaItem[] }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (items.length === 0) return null;
  if (items.length === 1) {
    const it = items[0]!;
    return <NoteMedia path={it.path} kind={it.kind} seconds={it.seconds} />;
  }

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(items.length - 1, index)));
  };

  return (
    <div className="w-full max-w-[260px]">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => (
          <div key={it.path} className="w-full shrink-0 snap-center">
            <NoteMedia path={it.path} kind={it.kind} seconds={it.seconds} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-center gap-1" aria-hidden="true">
        {items.map((it, i) => (
          <span
            key={it.path}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i === active ? "bg-current opacity-90" : "bg-current opacity-30",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function NoteMedia({
  path,
  kind,
  seconds,
}: {
  path: string;
  kind: string;
  seconds?: number | null | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.storage
      .from("note-media")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="h-10 w-40 animate-pulse rounded-lg bg-foreground/10" aria-hidden="true" />
    );
  }

  if (kind === "photo") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt="Attached photo"
          loading="lazy"
          className="max-h-64 w-full rounded-lg object-cover"
        />
      </a>
    );
  }

  if (kind === "video") {
    return <VideoPreview url={url} />;
  }

  return (
    <div className="flex items-center gap-2">
      <audio src={url} controls preload="none" className="h-9 w-56 max-w-full" />
      {typeof seconds === "number" && seconds > 0 && (
        <span className="font-mono text-[10px] opacity-70">{durationLabel(seconds)}</span>
      )}
    </div>
  );
}

function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-lg">
      <video
        ref={videoRef}
        src={`${url}#t=0.001`}
        controls={!playing}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="block max-h-64 w-full bg-black object-contain"
      />
      {playing && (
        <button
          type="button"
          aria-label="Pause video"
          className="absolute inset-0 cursor-pointer"
          onClick={() => videoRef.current?.pause()}
        />
      )}
    </div>
  );
}
