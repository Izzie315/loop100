import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { timeLabel, type PublicProfile } from "@/lib/talkloop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Note = {
  id: string;
  author_id: string;
  addressee_id: string;
  body: string;
  created_at: string;
};

export function Thread({ party, compact = false }: { party: PublicProfile; compact?: boolean }) {
  const { account } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const meId = account?.id;

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    void supabase
      .from("notes")
      .select("id, author_id, addressee_id, body, created_at")
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, party.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes.length]);

  const deliver = async () => {
    const body = draft.trim();
    if (!body || !meId || busy) return;
    setBusy(true);
    setDraft("");
    const { data } = await supabase
      .from("notes")
      .insert({ author_id: meId, addressee_id: party.id, body })
      .select("id, author_id, addressee_id, body, created_at")
      .single();
    if (data) {
      setNotes((prev) =>
        prev.some((n) => n.id === (data as Note).id) ? prev : [...prev, data as Note],
      );
    }
    setBusy(false);
  };

  const listed = useMemo(() => notes, [notes]);

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
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px] font-mono opacity-60",
                    mine ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {timeLabel(n.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void deliver();
        }}
      >
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
          aria-label="Deliver note"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
