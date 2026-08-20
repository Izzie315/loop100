import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { timeLabel, type PublicProfile } from "@/lib/talkloop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

export function Thread({ peer, compact = false }: { peer: PublicProfile; compact?: boolean }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const meId = user?.id;

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    void supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .or(
        `and(sender_id.eq.${meId},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${meId})`,
      )
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMessages((data as Message[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [meId, peer.id]);

  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`tl-thread-${meId}-${peer.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Message;
          const relevant =
            (row.sender_id === meId && row.recipient_id === peer.id) ||
            (row.sender_id === peer.id && row.recipient_id === meId);
          if (!relevant) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, peer.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !meId || sending) return;
    setSending(true);
    setDraft("");
    const { data } = await supabase
      .from("messages")
      .insert({ sender_id: meId, recipient_id: peer.id, body })
      .select("id, sender_id, recipient_id, body, created_at")
      .single();
    if (data) {
      setMessages((prev) =>
        prev.some((m) => m.id === (data as Message).id) ? prev : [...prev, data as Message],
      );
    }
    setSending(false);
  };

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex-1 space-y-2 overflow-y-auto px-1 py-3", compact && "max-h-64")}>
        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say something.
          </p>
        )}
        {grouped.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px] font-mono opacity-60",
                    mine ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {timeLabel(m.created_at)}
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
          void send();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Text ${peer.first_name}`}
          className="bg-muted border-border h-11 rounded-full"
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full">
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
