import { useEffect, useState } from "react";
import { ArrowLeft, NotebookPen, Phone, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { Thread } from "@/components/talkloop/Thread";
import {
  digitsOf,
  formatNumber,
  fullName,
  initialsOf,
  isValidNumber,
  timeLabel,
  type PublicProfile,
} from "@/lib/talkloop";

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
  const [composing, setComposing] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [finding, setFinding] = useState(false);
  const [findingName, setFindingName] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [nameMatches, setNameMatches] = useState<PublicProfile[]>([]);

  useEffect(() => {
    if (!findingName) return;
    const q = nameQuery.trim();
    if (q.length < 2) {
      setNameMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_profiles_by_name", { _query: q });
      setNameMatches((data as PublicProfile[] | null) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [nameQuery, findingName]);

  const closeNameSearch = () => {
    setFindingName(false);
    setNameQuery("");
    setNameMatches([]);
  };

  const [removing, setRemoving] = useState<PublicProfile | null>(null);

  const startNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber(dialNumber)) {
      toast.error("Enter a valid 10-digit TalkLoop number.");
      return;
    }
    setFinding(true);
    const { data } = await supabase.rpc("lookup_by_number", { _number: digitsOf(dialNumber) });
    setFinding(false);
    const found = (data as PublicProfile[] | null)?.[0];
    if (!found) {
      toast.error("No one has that TalkLoop number.");
      return;
    }
    if (found.id === account?.id) {
      toast.error("That's your own number.");
      return;
    }
    setComposing(false);
    setDialNumber("");
    setOpenParty(found);
  };

  const removeConversation = async (party: PublicProfile) => {
    if (!account) return;
    const me = account.id;
    setLoops((prev) => prev.filter((l) => l.party.id !== party.id));
    const { data } = await supabase
      .from("notes")
      .select("id, hidden_for")
      .or(
        `and(author_id.eq.${me},addressee_id.eq.${party.id}),and(author_id.eq.${party.id},addressee_id.eq.${me})`,
      );
    const rows = ((data ?? []) as { id: string; hidden_for: string[] | null }[]).filter(
      (r) => !(r.hidden_for ?? []).includes(me),
    );
    const results = await Promise.all(
      rows.map((r) =>
        supabase
          .from("notes")
          .update({ hidden_for: [...(r.hidden_for ?? []), me] })
          .eq("id", r.id),
      ),
    );
    if (results.some((r) => r.error)) {
      toast.error("Part of that conversation could not be removed.");
      void load();
    } else {
      toast.success("Conversation removed.");
    }
  };

  const load = async () => {
    if (!account) return;
    const { data } = await supabase
      .from("notes")
      .select("id, author_id, addressee_id, body, created_at, media_kind, hidden_for")
      .or(`author_id.eq.${account.id},addressee_id.eq.${account.id}`)
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data ?? []) as {
      author_id: string;
      addressee_id: string;
      body: string;
      created_at: string;
      media_kind: string | null;
      hidden_for: string[] | null;
    }[];

    const latest = new Map<string, { body: string; created_at: string }>();
    for (const row of rows) {
      if ((row.hidden_for ?? []).includes(account.id)) continue;
      const partyId = row.author_id === account.id ? row.addressee_id : row.author_id;
      const preview =
        row.body?.trim() ||
        (row.media_kind === "photo"
          ? "Photo"
          : row.media_kind === "video"
            ? "Video"
            : row.media_kind === "voice"
              ? "Voice note"
              : "");
      if (!latest.has(partyId)) latest.set(partyId, { body: preview, created_at: row.created_at });
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

  const composer = (
    <div className="mb-3">
      {composing ? (
        <form onSubmit={startNew} className="panel flex items-center gap-2 p-2">
          <Input
            autoFocus
            inputMode="numeric"
            value={dialNumber}
            onChange={(e) => setDialNumber(formatNumber(e.target.value))}
            placeholder="(317) 555-0142"
            className="bg-muted font-mono"
            aria-label="TalkLoop number"
          />
          <Button type="submit" disabled={finding}>
            Start
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setComposing(false);
              setDialNumber("");
            }}
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : findingName ? (
        <div className="panel space-y-2 p-2">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Type a name"
              className="bg-muted"
              aria-label="Name"
            />
            <Button type="button" size="icon" variant="ghost" onClick={closeNameSearch} aria-label="Cancel">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {nameQuery.trim().length >= 2 && nameMatches.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">No one by that name yet.</p>
          )}
          {nameMatches.length > 0 && (
            <ul className="space-y-1">
              {nameMatches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      closeNameSearch();
                      setOpenParty(m);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initialsOf(m)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{fullName(m)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{m.talkloop_number}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button className="gap-2" onClick={() => setComposing(true)}>
            <Plus className="h-4 w-4" /> New note to any number
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => setFindingName(true)}>
            <Search className="h-4 w-4" /> New note by name
          </Button>
        </div>
      )}
    </div>
  );

  const removeDialog = (
    <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            All notes with {removing ? fullName(removing) : ""} will disappear from your list. Their
            contact card stays saved, and they still keep their own copy.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (removing) void removeConversation(removing);
              setRemoving(null);
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (loops.length === 0) {
    return (
      <div>
        {composer}
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <NotebookPen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No notes yet. Start one with any TalkLoop number.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {composer}
      <ul className="space-y-2 pb-6">
        {loops.map((l) => (
          <li key={l.party.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpenParty(l.party)}
              className="panel flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-accent"
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
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setRemoving(l.party)}
              aria-label={`Remove conversation with ${fullName(l.party)}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {removeDialog}
    </div>
  );
}
