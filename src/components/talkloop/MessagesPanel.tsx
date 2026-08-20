import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Phone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { Thread } from "@/components/talkloop/Thread";
import { fullName, initialsOf, timeLabel, type PublicProfile } from "@/lib/talkloop";

type ThreadSummary = {
  peer: PublicProfile;
  lastBody: string;
  lastAt: string;
};

export function MessagesPanel({
  openPeer,
  setOpenPeer,
}: {
  openPeer: PublicProfile | null;
  setOpenPeer: (peer: PublicProfile | null) => void;
}) {
  const { user } = useAuth();
  const { startCall } = useCall();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as {
      sender_id: string;
      recipient_id: string;
      body: string;
      created_at: string;
    }[];

    const latest = new Map<string, { body: string; created_at: string }>();
    for (const row of rows) {
      const peerId = row.sender_id === user.id ? row.recipient_id : row.sender_id;
      if (!latest.has(peerId)) latest.set(peerId, { body: row.body, created_at: row.created_at });
    }
    const ids = [...latest.keys()];
    if (ids.length === 0) {
      setThreads([]);
      return;
    }
    const { data: profiles } = await supabase.rpc("get_profiles_public", { _ids: ids });
    const list = ((profiles as PublicProfile[] | null) ?? []).map((p) => ({
      peer: p,
      lastBody: latest.get(p.id)!.body,
      lastAt: latest.get(p.id)!.created_at,
    }));
    list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    setThreads(list);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`tl-inbox-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (openPeer) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex items-center gap-3 border-b border-border pb-3">
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setOpenPeer(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fullName(openPeer)}</p>
            <p className="font-mono text-xs text-muted-foreground">{openPeer.talkloop_number}</p>
          </div>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => void startCall(openPeer)}
            aria-label="Call"
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
        <Thread peer={openPeer} />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No messages yet. Open a contact to leave someone a text.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 pb-6">
      {threads.map((t) => (
        <li key={t.peer.id}>
          <button
            type="button"
            onClick={() => setOpenPeer(t.peer)}
            className="panel flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initialsOf(t.peer)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName(t.peer)}</p>
              <p className="truncate text-xs text-muted-foreground">{t.lastBody}</p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {timeLabel(t.lastAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
