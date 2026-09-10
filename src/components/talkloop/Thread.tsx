import { useEffect, useMemo, useRef, useState } from "react";
import {
  SendHorizonal as DeliverIcon,
  ImagePlus,
  Camera,
  Mic,
  Square,
  X,
  Pencil,
  Trash2,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { durationLabel, timeLabel, type PublicProfile } from "@/lib/talkloop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoteMedia } from "@/components/talkloop/NoteMedia";

export type Note = {
  id: string;
  author_id: string;
  addressee_id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  hidden_for?: string[] | null;
  media_url?: string | null;
  media_kind?: string | null;
  media_seconds?: number | null;
};

type Pending = {
  file: File;
  kind: "photo" | "voice";
  previewUrl: string;
  seconds?: number;
};

const COLUMNS =
  "id, author_id, addressee_id, body, created_at, edited_at, hidden_for, media_url, media_kind, media_seconds";

export function Thread({ party, compact = false }: { party: PublicProfile; compact?: boolean }) {
  const { account } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pickRef = useRef<HTMLInputElement | null>(null);
  const captureRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<Note | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const meId = account?.id;

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    void supabase
      .from("notes")
      .select(COLUMNS)
      .or(
        `and(author_id.eq.${meId},addressee_id.eq.${party.id}),and(author_id.eq.${party.id},addressee_id.eq.${meId})`,
      )
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setNotes((data as Note[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [meId, party.id]);

  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`tl-thread-${meId}-${party.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, (payload) => {
        const row = payload.new as Note;
        const relevant =
          (row.author_id === meId && row.addressee_id === party.id) ||
          (row.author_id === party.id && row.addressee_id === meId);
        if (!relevant) return;
        setNotes((prev) => (prev.some((n) => n.id === row.id) ? prev : [...prev, row]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes" }, (payload) => {
        const row = payload.new as Note;
        setNotes((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, (payload) => {
        const gone = payload.old as { id?: string };
        if (!gone?.id) return;
        setNotes((prev) => prev.filter((n) => n.id !== gone.id));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, party.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes.length]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const clearPending = () => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("That photo is too large (20 MB max).");
      return;
    }
    clearPending();
    setPending({ file, kind: "photo", previewUrl: URL.createObjectURL(file) });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      let elapsed = 0;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size < 1024) {
          toast.error("That recording was empty — try again.");
          return;
        }
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice.${ext}`, { type });
        clearPending();
        setPending({
          file,
          kind: "voice",
          previewUrl: URL.createObjectURL(blob),
          seconds: elapsed,
        });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecSeconds(0);
      tickRef.current = setInterval(() => {
        elapsed += 1;
        setRecSeconds(elapsed);
        if (elapsed >= 300) recorder.stop();
      }, 1000);
    } catch {
      toast.error("Microphone access is needed to record.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const deliver = async () => {
    const body = draft.trim();
    if ((!body && !pending) || !meId || busy || recording) return;
    setBusy(true);
    const attached = pending;
    setDraft("");
    setPending(null);

    let mediaUrl: string | null = null;
    if (attached) {
      const ext = attached.file.name.split(".").pop() || "bin";
      const path = `${meId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("note-media")
        .upload(path, attached.file, { contentType: attached.file.type, upsert: false });
      URL.revokeObjectURL(attached.previewUrl);
      if (error) {
        toast.error("That attachment could not be delivered.");
        setBusy(false);
        return;
      }
      mediaUrl = path;
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        author_id: meId,
        addressee_id: party.id,
        body,
        media_url: mediaUrl,
        media_kind: attached?.kind ?? null,
        media_seconds: attached?.seconds ?? null,
      })
      .select(COLUMNS)
      .single();
    if (error) toast.error("That note could not be delivered.");
    if (data) {
      setNotes((prev) =>
        prev.some((n) => n.id === (data as Note).id) ? prev : [...prev, data as Note],
      );
    }
    setBusy(false);
  };

  const listed = useMemo(
    () => notes.filter((n) => !(n.hidden_for ?? []).includes(meId ?? "")),
    [notes, meId],
  );

  const beginPress = (note: Note) => {
    if (pressRef.current) clearTimeout(pressRef.current);
    pressRef.current = setTimeout(() => setSelected(note), 500);
  };
  const endPress = () => {
    if (pressRef.current) clearTimeout(pressRef.current);
    pressRef.current = null;
  };

  const unsend = async (note: Note) => {
    setSelected(null);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (note.media_url) {
      await supabase.storage.from("note-media").remove([note.media_url]);
    }
    const { error } = await supabase.from("notes").delete().eq("id", note.id);
    if (error) toast.error("That note could not be pulled back.");
  };

  const hideForMe = async (note: Note) => {
    setSelected(null);
    if (!meId) return;
    const next = Array.from(new Set([...(note.hidden_for ?? []), meId]));
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, hidden_for: next } : n)));
    const { error } = await supabase.from("notes").update({ hidden_for: next }).eq("id", note.id);
    if (error) toast.error("That note could not be removed from your view.");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = editDraft.trim();
    if (!body && !editing.media_url) return;
    const stamp = new Date().toISOString();
    setNotes((prev) =>
      prev.map((n) => (n.id === editing.id ? { ...n, body, edited_at: stamp } : n)),
    );
    setEditing(null);
    const { error } = await supabase
      .from("notes")
      .update({ body, edited_at: stamp })
      .eq("id", editing.id);
    if (error) toast.error("That change could not be saved.");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex-1 space-y-2 overflow-y-auto px-1 py-3", compact && "max-h-64")}>
        {listed.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No notes yet. Say something.
          </p>
        )}
        {listed.map((n) => {
          const mine = n.author_id === meId;
          return (
            <div key={n.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                role="button"
                tabIndex={0}
                onPointerDown={() => beginPress(n)}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onPointerCancel={endPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelected(n);
                }}
                className={cn(
                  "max-w-[78%] cursor-pointer select-none space-y-2 rounded-2xl px-3.5 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm",
                )}
              >
                {n.media_url && n.media_kind && (
                  <NoteMedia path={n.media_url} kind={n.media_kind} seconds={n.media_seconds} />
                )}
                {n.body && <p className="whitespace-pre-wrap break-words">{n.body}</p>}
                <p
                  className={cn(
                    "mt-1 text-[10px] font-mono opacity-60",
                    mine ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {timeLabel(n.created_at)}
                  {n.edited_at ? " · edited" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Note options</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {selected?.author_id === meId && (
              <>
                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    setEditDraft(selected.body ?? "");
                    setEditing(selected);
                    setSelected(null);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="destructive"
                  className="justify-start"
                  onClick={() => void unsend(selected)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Pull back for everyone
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => selected && void hideForMe(selected)}
            >
              <EyeOff className="mr-2 h-4 w-4" /> Remove just for me
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            className="min-h-24"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {pending && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2">
          {pending.kind === "photo" ? (
            <img
              src={pending.previewUrl}
              alt="Attachment preview"
              className="h-14 w-14 rounded-lg object-cover"
            />
          ) : (
            <audio src={pending.previewUrl} controls className="h-9 flex-1" />
          )}
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {pending.kind === "photo"
              ? "Photo ready"
              : `Recording ready · ${durationLabel(pending.seconds ?? 0)}`}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={clearPending}
            aria-label="Discard attachment"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {recording && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="font-mono text-xs text-primary">
            Recording · {durationLabel(recSeconds)}
          </span>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void deliver();
        }}
      >
        <input
          ref={pickRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={captureRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-full"
          onClick={() => pickRef.current?.click()}
          aria-label="Attach a photo"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-full"
          onClick={() => captureRef.current?.click()}
          aria-label="Take a photo"
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={recording ? "default" : "ghost"}
          className="h-11 w-11 shrink-0 rounded-full"
          onClick={() => (recording ? stopRecording() : void startRecording())}
          aria-label={recording ? "Stop recording" : "Record your voice"}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Note to ${party.first_name}`}
          className="bg-muted border-border h-11 rounded-full"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={busy || recording || (!draft.trim() && !pending)}
          aria-label="Deliver note"
        >
          <DeliverIcon className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
