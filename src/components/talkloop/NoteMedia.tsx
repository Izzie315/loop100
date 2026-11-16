import { useEffect, useRef, useState } from "react";

import { cachedMediaUrl, signedMediaUrl } from "@/lib/signed-media";
import { durationLabel } from "@/lib/talkloop";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

export type MediaItem = { path: string; kind: string; seconds?: number | null };

export function NoteMediaList({ items }: { items: MediaItem[] }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (items.length === 0) return null;
  if (items.length === 1) {
    const it = items[0];
    if (!it) return null;
    return <NoteMedia path={it.path} kind={it.kind} seconds={it.seconds} />;
  }

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(items.length - 1, index)));
  };

  return (
    <div className="w-[240px] max-w-full min-w-0">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => (
          <div key={it.path} className="w-full min-w-0 shrink-0 snap-center">
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
  const [url, setUrl] = useState<string | null>(() => cachedMediaUrl(path));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const refresh = (fresh: boolean) =>
      signedMediaUrl(path, fresh).then((next) => {
        if (cancelled) return;
        setUrl(next);
        setFailed(!next);
      });
    void refresh(attempt > 0);
    const timer = setInterval(() => void refresh(true), 50 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path, attempt]);

  const frame = kind === "voice" ? "h-10 w-56 max-w-full" : "aspect-square w-[240px] max-w-full";

  if (failed) {
    return (
      <div className={cn(frame, "flex flex-col items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground")}>
        <span className="text-xs">Attachment unavailable</span>
        <Button size="icon" variant="ghost" aria-label="Retry attachment" onClick={() => setAttempt((value) => value + 1)}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!url) {
    return (
      <div className={cn(frame, "animate-pulse rounded-xl bg-foreground/10")} aria-hidden="true" />
    );
  }

  if (kind === "photo") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cn(frame, "block overflow-hidden rounded-xl bg-muted")}>
        <img
          src={url}
          alt="Attached photo"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  if (kind === "video") {
    return <VideoPreview url={url} onFail={() => setFailed(true)} />;
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

function VideoPreview({ url, onFail }: { url: string; onFail: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-square w-[240px] max-w-full overflow-hidden rounded-xl bg-muted">
      <video
        ref={videoRef}
        src={`${url}#t=0.001`}
        controls={!playing}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={onFail}
        className="block h-full w-full rounded-xl object-contain"
      />
      {playing && (
        <Button
          type="button"
          variant="ghost"
          aria-label="Pause video"
          className="absolute inset-0 h-full w-full cursor-pointer rounded-none hover:bg-transparent"
          onClick={() => videoRef.current?.pause()}
        />
      )}
    </div>
  );
}
