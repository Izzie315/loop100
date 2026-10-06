import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupThread } from "@/components/talkloop/GroupThread";
import { cn } from "@/lib/utils";
import {
  contactName,
  fullName,
  timeLabel,
  type ContactEntry,
  type PublicProfile,
} from "@/lib/talkloop";

type Loop = { id: string; name: string; owner_id: string; created_at: string };
type GroupNote = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function GroupsPanel({ contacts }: { contacts: ContactEntry[] }) {
  const { profile } = useAuth();
  const [loops, setLoops] = useState<Loop[]>([]);
  const [open, setOpen] = useState<Loop | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { data: members } = await supabase
        .from("group_members")
        .select("member_id")
        .eq("group_id", open.id);
      const ids = ((members ?? []) as { member_id: string }[]).map((m) => m.member_id);
      if (ids.length === 0) return;
      const { data: profiles } = await supabase.rpc("get_profiles_public", { _ids: ids });
      const map: Record<string, string> = {};
      for (const p of ((profiles as PublicProfile[] | null) ?? [])) {
        const saved = contacts.find((c) => c.id === p.id);
        map[p.id] = saved ? contactName(saved) : fullName(p);
      }
      if (!cancelled) setMemberNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contacts]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data: mine } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("member_id", profile.id);
    const ids = ((mine ?? []) as { group_id: string }[]).map((r) => r.group_id);
    if (ids.length === 0) {
      setLoops([]);
      return;
    }
    const { data } = await supabase
      .from("groups")
      .select("id, name, owner_id, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setLoops((data ?? []) as Loop[]);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!profile || busy) return;
    if (!name.trim()) {
      toast.error("Give the loop a name.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), owner_id: profile.id })
      .select("id, name, owner_id, created_at")
      .single();
    if (error || !data) {
      setBusy(false);
      toast.error("Could not create that loop.");
      return;
    }
    const members = Array.from(new Set([profile.id, ...picked])).map((id) => ({
      group_id: (data as Loop).id,
      member_id: id,
    }));
    const { error: memberError } = await supabase.from("group_members").insert(members);
    setBusy(false);
    if (memberError) {
      toast.error("The loop was made but some people could not be added.");
    }
    setCreating(false);
    setName("");
    setPicked([]);
    await load();
    setOpen(data as Loop);
  };

  if (open) {
    return (
    <GroupThread
      loopId={open.id}
      loopName={open.name}
      names={memberNames}
      onBack={() => setOpen(null)}
    />
  );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Loops</h2>
        <Button
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => setCreating(true)}
          aria-label="Start a loop"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loops.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No loops yet. Tap the plus to start one with as many people as you like.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {loops.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setOpen(l)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs text-primary">
                  {l.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start a loop</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="loopname">Loop name</Label>
              <Input
                id="loopname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted"
                placeholder="Weekend crew"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Who is in it</Label>
              <p className="text-xs text-muted-foreground">You are always included.</p>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                {contacts.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Save some contacts first.
                  </p>
                )}
                {contacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary"
                  >
                    <Checkbox
                      checked={picked.includes(c.id)}
                      onCheckedChange={(v) =>
                        setPicked((prev) =>
                          v ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{contactName(c)}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button className="h-11 w-full" onClick={() => void create()} disabled={busy}>
              Create loop
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
