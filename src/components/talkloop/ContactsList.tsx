import { useState } from "react";
import { NotebookPen, Pencil, Phone, Trash2, Users as GroupIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { contactInitials, contactName, type ContactEntry } from "@/lib/talkloop";

export function ContactsList({
  contacts,
  onChanged,
  onNote,
}: {
  contacts: ContactEntry[];
  onChanged: () => void;
  onNote: (party: ContactEntry) => void;
}) {
  const { account } = useAuth();
  const { startCall } = useCall();
  const [editing, setEditing] = useState<ContactEntry | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const openEditor = (c: ContactEntry) => {
    setEditing(c);
    setFirst(c.nickname_first ?? c.first_name);
    setLast(c.nickname_last ?? c.last_name);
    setLabel(c.label ?? "");
    setMemo(c.memo ?? "");
  };

  const save = async () => {
    if (!account || !editing) return;
    if (!first.trim()) {
      toast.error("A first name is required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({
        nickname_first: first.trim(),
        nickname_last: last.trim() || null,
        label: label.trim() || null,
        memo: memo.trim() || null,
      })
      .eq("owner_id", account.id)
      .eq("contact_id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save those details.");
      return;
    }
    toast.success("Contact details saved.");
    setEditing(null);
    onChanged();
  };

  const remove = async (id: string) => {
    if (!account) return;
    await supabase.from("contacts").delete().eq("owner_id", account.id).eq("contact_id", id);
    onChanged();
  };

  const sections = contacts.reduce<Record<string, ContactEntry[]>>((acc, c) => {
    const letter = (contactName(c)[0] ?? "#").toUpperCase();
    (acc[letter] ??= []).push(c);
    return acc;
  }, {});

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <GroupIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No contacts yet. Dial a TalkLoop number and tap the add icon to save it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {Object.keys(sections)
        .sort()
        .map((letter) => (
          <section key={letter}>
            <h3 className="mb-2 px-1 font-mono text-xs tracking-[0.3em] text-primary">{letter}</h3>
            <ul className="space-y-2">
              {sections[letter]!.map((c) => (
                <li key={c.id} className="panel flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {contactInitials(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {contactName(c)}
                      {c.label ? (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {c.label}
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{c.talkloop_number}</p>
                    {c.memo ? (
                      <p className="truncate text-xs text-muted-foreground">{c.memo}</p>
                    ) : null}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full"
                    onClick={() => openEditor(c)}
                    aria-label={`Edit details for ${contactName(c)}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full"
                    onClick={() => onNote(c)}
                    aria-label={`Leave a note for ${contactName(c)}`}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => void startCall(c)}
                    aria-label={`Call ${contactName(c)}`}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full text-muted-foreground"
                    onClick={() => void remove(c.id)}
                    aria-label={`Remove ${contactName(c)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contact details</DialogTitle>
            <DialogDescription>
              These details are only visible to you. TalkLoop numbers are set by their owner and
              can't be changed here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact-first">First name</Label>
                <Input
                  id="contact-first"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-last">Last name</Label>
                <Input id="contact-last" value={last} onChange={(e) => setLast(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-label">Label</Label>
              <Input
                id="contact-label"
                placeholder="Work, Family, Team…"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-memo">Memo</Label>
              <Textarea
                id="contact-memo"
                rows={3}
                placeholder="Anything you want to remember"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {editing?.talkloop_number}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
