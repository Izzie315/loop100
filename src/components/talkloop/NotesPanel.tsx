import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LogIn, LogOut, NotebookPen, Phone, Plus, Trash2, Users as GroupIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Thread } from "@/components/talkloop/Thread";
import { GroupThread } from "@/components/talkloop/GroupThread";
import { cn } from "@/lib/utils";
import { fullName, initialsOf, type PublicProfile } from "@/lib/talkloop";

type Group = {
  id: string;
  name: string;
  owner_id: string;
  joined: boolean;
};

export function NotesPanel({
  contacts,
  openParty,
  setOpenParty,
}: {
  contacts: PublicProfile[];
  openParty: PublicProfile | null;
  setOpenParty: (party: PublicProfile | null) => void;
}) {
  const { account } = useAuth();
  const { startCall } = useCall();
  const [groups, setGroups] = useState<Group[]>([]);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!account) return;
    const [{ data: all }, { data: mine }] = await Promise.all([
      supabase.from("groups").select("id, name, owner_id").order("name"),
      supabase.from("group_members").select("group_id").eq("member_id", account.id),
    ]);
    const joinedIds = new Set(((mine ?? []) as { group_id: string }[]).map((r) => r.group_id));
    const list = ((all ?? []) as Omit<Group, "joined">[]).map((g) => ({
      ...g,
      joined: joinedIds.has(g.id),
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    setGroups(list);
    setOpenGroup((prev) => (prev ? (list.find((g) => g.id === prev.id) ?? null) : null));
  }, [account]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!account || !name || creating) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("groups")
      .insert({ name, owner_id: account.id })
      .select("id, name, owner_id")
      .single();
    if (!error && data) {
      await supabase.from("group_members").insert({ group_id: data.id, member_id: account.id });
      setNewName("");
      await loadGroups();
      setOpenParty(null);
      setOpenGroup({ ...(data as Omit<Group, "joined">), joined: true });
    } else {
      toast.error("Could not create that group.");
    }
    setCreating(false);
  };

  const joinGroup = async (g: Group) => {
    if (!account) return;
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: g.id, member_id: account.id });
    if (error) {
      toast.error("Could not join that group.");
      return;
    }
    await loadGroups();
    setOpenParty(null);
    setOpenGroup({ ...g, joined: true });
  };

  const leaveGroup = async (g: Group) => {
    if (!account) return;
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", g.id)
      .eq("member_id", account.id);
    if (openGroup?.id === g.id) setOpenGroup(null);
    await loadGroups();
  };

  const deleteGroup = async (g: Group) => {
    const { error } = await supabase.from("groups").delete().eq("id", g.id);
    if (error) {
      toast.error("Only the creator can remove a group.");
      return;
    }
    if (openGroup?.id === g.id) setOpenGroup(null);
    await loadGroups();
  };

  const sortedContacts = [...contacts].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const hasSelection = Boolean(openParty || openGroup);

  const sidebar = (
    <div className="flex min-h-0 w-full flex-col md:w-64 md:shrink-0 md:border-r md:border-border md:pr-4">
      <form onSubmit={createGroup} className="mb-3 flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New group name"
          className="bg-muted h-9 rounded-full text-sm"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          disabled={creating}
          aria-label="Create group"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
        <section>
          <h3 className="mb-2 px-1 font-mono text-[10px] tracking-[0.3em] text-primary">GROUPS</h3>
          {groups.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">No groups yet. Create one above.</p>
          )}
          <ul className="space-y-1">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!g.joined}
                  onClick={() => {
                    setOpenParty(null);
                    setOpenGroup(g);
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    openGroup?.id === g.id
                      ? "bg-accent text-primary"
                      : "text-foreground hover:bg-secondary",
                    !g.joined && "opacity-60",
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{g.name}</span>
                </button>
                {g.joined ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => void leaveGroup(g)}
                    aria-label={`Leave ${g.name}`}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-primary"
                    onClick={() => void joinGroup(g)}
                    aria-label={`Join ${g.name}`}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                  </Button>
                )}
                {g.owner_id === account?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => void deleteGroup(g)}
                    aria-label={`Delete ${g.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 px-1 font-mono text-[10px] tracking-[0.3em] text-primary">
            CONTACTS
          </h3>
          {sortedContacts.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              No contacts yet. Save one from the keypad.
            </p>
          )}
          <ul className="space-y-1">
            {sortedContacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenGroup(null);
                    setOpenParty(c);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    openParty?.id === c.id
                      ? "bg-accent text-primary"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                    {initialsOf(c)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{fullName(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );

  const detail = (
    <div className="flex min-h-0 flex-1 flex-col md:pl-4">
      {openParty && (
        <>
          <div className="mb-2 flex items-center gap-3 border-b border-border pb-3">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 md:hidden"
              onClick={() => setOpenParty(null)}
            >
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
        </>
      )}

      {openGroup && (
        <>
          <div className="mb-2 flex items-center gap-3 border-b border-border pb-3">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 md:hidden"
              onClick={() => setOpenGroup(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{openGroup.name}</p>
              <p className="font-mono text-xs text-muted-foreground">Group loop</p>
            </div>
          </div>
          <GroupThread groupId={openGroup.id} groupName={openGroup.name} />
        </>
      )}

      {!hasSelection && (
        <div className="hidden flex-col items-center justify-center gap-3 py-16 text-center md:flex">
          <NotebookPen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Pick a contact or a group to see everything left there.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      <div className={cn("min-h-0 flex-1 md:flex-none", hasSelection && "hidden md:flex md:flex-col")}>
        {sidebar}
      </div>
      <div className={cn("min-h-0 flex-1 flex-col", hasSelection ? "flex" : "hidden md:flex")}>
        {detail}
      </div>
    </div>
  );
}
