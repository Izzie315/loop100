import { useEffect, useRef, useState } from "react";
import { SendHorizonal as DeliverIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { fullName, timeLabel, type PublicProfile } from "@/lib/talkloop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type GroupNote = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function GroupThread({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { account } = useAuth();
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const meId = account?.id;

  const hydrateNames = async (rows: GroupNote[]) => {
    const ids = [...new Set(rows.map((r) => r.author_id))];
    if (ids.length === 0) return;
    const { data } = await supabase.rpc("get_profiles_public", { _ids: ids });
    const map: Record<string, string> = {};
    for (const p of ((data as PublicProfile[] | null) ?? [])) map[p.id] = fullName(p);
    setNames((prev) => ({ ...prev, ...map }));
  };

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("group_notes")
      .select("id, group_id, author_id, body, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data as GroupNote[]) ?? [];
        setNotes(rows);
        void hydrateNames(rows);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    const channel = supabase
      .channel(`tl-group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_notes", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as GroupNote;
          setNotes((prev) => (prev.some((n) => n.id === row.id) ? prev : [...prev, row]));
          void hydrateNames([row]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes.length]);

  const deliver = async () => {
    const body = draft.trim();
    if (!body || !meId || busy) return;
    setBusy(true);
    setDraft("");
    const { data } = await supabase
      .from("group_notes")
      .insert({ group_id: groupId, author_id: meId, body })
      .select("id, group_id, author_id, body, created_at")
      .single();
    if (data) {
      const row = data as GroupNote;
      setNotes((prev) => (prev.some((n) => n.id === row.id) ? prev : [...prev, row]));
    }
    setBusy(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-3">
        {notes.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing left in {groupName} yet.
          </p>
        )}
        {notes.map((n) => {
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
                {!mine && (
                  <p className="mb-0.5 font-mono text-[10px] text-primary">
                    {names[n.author_id] ?? "Member"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-[10px] opacity-60",
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
          placeholder={`Note to ${groupName}`}
          className="bg-muted border-border h-11 rounded-full"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label="Deliver note"
        >
          <DeliverIcon className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
