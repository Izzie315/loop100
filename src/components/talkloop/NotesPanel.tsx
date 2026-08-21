import { useEffect, useState } from "react";
import { ArrowLeft, NotebookPen, Phone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { Thread } from "@/components/talkloop/Thread";
import { fullName, initialsOf, timeLabel, type PublicProfile } from "@/lib/talkloop";

type LoopSummary = {
  party: PublicProfile;
  lastBody: string;
  lastAt: string;
};

export function NotesPanel({
  openParty,
  setOpenParty,
}: {
  openParty: PublicProfile | null;
  setOpenParty: (party: PublicProfile | null) => void;
}) {
  const { account } = useAuth();
  const { startCall } = useCall();
  const [loops, setLoops] = useState<LoopSummary[]>([]);

  const load = async () => {
    if (!account) return;
    const { data } = await supabase
      .from("notes")
      .select("id, author_id, addressee_id, body, created_at")
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as {
      author_id: string;
      addressee_id: string;
      body: string;
      created_at: string;
    }[];

    const latest = new Map<string, { body: string; created_at: string }>();
    for (const row of rows) {
      const partyId = row.author_id === account.id ? row.addressee_id : row.author_id;
      if (!latest.has(partyId)) latest.set(partyId, { body: row.body, created_at: row.created_at });
    }
    const ids = [...latest.keys()];
    if (ids.length === 0) {
      setLoops([]);
      return;
    }
    const { data: profiles } = await supabase.rpc("get_profiles_public", { _ids: ids });
    const list = ((profiles as PublicProfile[] | null) ?? []).map((p) => ({
      party: p,
      lastBody: latest.get(p.id)!.body,
      lastAt: latest.get(p.id)!.created_at,
    }));
    list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    setLoops(list);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  useEffect(() => {
    if (!account) return;
    const channel = supabase
      .channel(`tl-loops-${account.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (openParty) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex items-center gap-3 border-b border-border pb-3">
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setOpenParty(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fullName(openParty)}</p>
            <p className="font-mono text-xs text-muted-foreground">{openParty.talkloop_number}</p>
          </div>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => void startCall(openParty)}
            aria-label="Call"
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
        <Thread party={openParty} />
      </div>
    );
  }

  if (loops.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <NotebookPen className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No notes yet. Open a contact to leave one behind.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 pb-6">
      {loops.map((l) => (
        <li key={l.party.id}>
          <button
            type="button"
            onClick={() => setOpenParty(l.party)}
            className="panel flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initialsOf(l.party)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName(l.party)}</p>
              <p className="truncate text-xs text-muted-foreground">{l.lastBody}</p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {timeLabel(l.lastAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
