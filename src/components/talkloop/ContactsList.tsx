import { useState } from "react";
import { NotebookPen, Pencil, Phone, Plus, Trash2, Users as GroupIcon } from "lucide-react";
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
import {
  contactInitials,
  contactName,
  digitsOf,
  formatNumber,
  fullName,
  type ContactEntry,
  type PublicProfile,
} from "@/lib/talkloop";

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
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");

  const openEditor = (c: ContactEntry) => {
    setEditing(c);
    setName(`${c.nickname_first ?? ""} ${c.nickname_last ?? ""}`.trim());
    setLabel(c.label ?? "");
    setMemo(c.memo ?? "");
  };

  const save = async () => {
    if (!account || !editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({
        nickname_first: name.trim() || null,
        nickname_last: null,
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

  const addContact = async () => {
    if (!account) return;
    const digits = digitsOf(newNumber);
    if (digits.length !== 10) {
      toast.error("Enter a 10-digit TalkLoop number.");
      return;
    }
    setSaving(true);
    const { data } = await supabase.rpc("lookup_by_number", { _number: digits });
    const found = ((data as PublicProfile[] | null) ?? [])[0];
    if (!found) {
      setSaving(false);
      toast.error("No TalkLoop account has that number.");
      return;
    }
    if (found.id === account.id) {
      setSaving(false);
      toast.error("That's your own number.");
      return;
    }
    const { error } = await supabase.from("contacts").insert({
      owner_id: account.id,
      contact_id: found.id,
      nickname_first: newName.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("They're already in your contacts.");
      return;
    }
    toast.success(`${newName.trim() || fullName(found)} saved.`);
    setAdding(false);
    setNewNumber("");
    setNewName("");
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

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => setAdding(true)}
          aria-label="Add a contact"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {contacts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <GroupIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No contacts yet. Tap the plus button to add one.
          </p>
        </div>
      )}

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

      <Dialog open={adding} onOpenChange={(open) => !open && setAdding(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a contact</DialogTitle>
            <DialogDescription>
              Enter their TalkLoop number. A name is optional — call them whatever you like.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-number">TalkLoop number</Label>
              <Input
                id="add-number"
                inputMode="numeric"
                className="font-mono"
                placeholder="(317) 555-0142"
                value={newNumber}
                onChange={(e) => setNewNumber(formatNumber(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">Name (optional)</Label>
              <Input
                id="add-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="However you want to list them"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void addContact()} disabled={saving}>
              Save contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name (optional)</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="However you want to list them"
              />
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
            {editing ? (
              <p className="font-mono text-xs text-muted-foreground">{editing.talkloop_number}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => void save()} disabled={saving}>
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
