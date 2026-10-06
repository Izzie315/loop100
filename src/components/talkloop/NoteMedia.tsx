import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { durationLabel } from "@/lib/talkloop";

export type MediaItem = { path: string; kind: string; seconds?: number | null };

export function NoteMediaList({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;
  if (items.length === 1) {
    const it = items[0]!;
    return <NoteMedia path={it.path} kind={it.kind} seconds={it.seconds} />;
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((it) => (
        <NoteMedia key={it.path} path={it.path} kind={it.kind} seconds={it.seconds} />
      ))}
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
    return (
      <video
        src={url}
        controls
        preload="metadata"
        playsInline
        className="max-h-64 w-full rounded-lg bg-black object-contain"
      />
    );
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
