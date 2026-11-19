import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notifyParty } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  digitsOf,
  formatNumber,
  fullName,
  isValidNumber,
  type PublicProfile,
} from "@/lib/talkloop";

/** Look up one TalkLoop number; returns the profile or shows why not. */
export async function findByNumber(raw: string, meId?: string): Promise<PublicProfile | null> {
  if (!isValidNumber(raw)) {
    toast.error("Enter a valid 10-digit TalkLoop number.");
    return null;
  }
  const { data } = await supabase.rpc("lookup_by_number", { _number: digitsOf(raw) });
  const found = (data as PublicProfile[] | null)?.[0];
  if (!found) {
    toast.error("No one has that TalkLoop number.");
    return null;
  }
  if (found.id === meId) {
    toast.error("That's your own number.");
    return null;
  }
  return found;
}

/** Start a note to one or several TalkLoop numbers. */
export function NewNoteStarter({ onPick }: { onPick: (party: PublicProfile) => void }) {
  const { account } = useAuth();
  const [composing, setComposing] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [finding, setFinding] = useState(false);
  const [picked, setPicked] = useState<PublicProfile[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setComposing(false);
    setDialNumber("");
    setPicked([]);
    setBody("");
  };

  const addNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinding(true);
    const found = await findByNumber(dialNumber, account?.id);
    setFinding(false);
    if (!found) return;
    setPicked((prev) => (prev.some((p) => p.id === found.id) ? prev : [...prev, found]));
    setDialNumber("");
  };

  const deliver = async () => {
    if (!account || busy || picked.length === 0) return;
    if (picked.length === 1 && !body.trim()) {
      const only = picked[0]!;
      reset();
      onPick(only);
      return;
    }
    if (!body.trim()) {
      toast.error("Write a note first.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("notes")
      .insert(picked.map((p) => ({ author_id: account.id, addressee_id: p.id, body: body.trim() })))
      .select("id");
    setBusy(false);
    if (error) {
      toast.error("That note could not be delivered.");
      return;
    }
    for (const row of (data ?? []) as { id: string }[]) notifyParty("note", row.id);
    toast.success(`Note delivered to ${picked.length} ${picked.length === 1 ? "person" : "people"}.`);
    const first = picked.length === 1 ? picked[0]! : null;
    reset();
    if (first) onPick(first);
  };

  if (!composing) {
    return (
      <Button className="w-full gap-2" onClick={() => setComposing(true)}>
        <Plus className="h-4 w-4" /> New note to any number
      </Button>
    );
  }

  return (
    <div className="panel space-y-2 p-2">
      <form onSubmit={addNumber} className="flex items-center gap-2">
        <Input
          autoFocus
          inputMode="numeric"
          value={dialNumber}
          onChange={(e) => setDialNumber(formatNumber(e.target.value))}
          placeholder="(317) 555-0142"
          className="bg-muted font-mono"
          aria-label="TalkLoop number"
        />
        <Button type="submit" variant="secondary" disabled={finding}>
          Add
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={reset} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </form>
      {picked.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1 rounded-full bg-accent py-1 pl-3 pr-1 text-xs text-accent-foreground"
              >
                <span>{fullName(p)}</span>
                <button
                  type="button"
                  onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                  className="rounded-full p-0.5 hover:bg-background/50"
                  aria-label={`Take off ${fullName(p)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={picked.length === 1 ? "Write a note (or leave empty to open the conversation)" : "Write a note for everyone"}
            className="min-h-[70px] bg-muted"
          />
          <Button className="w-full" onClick={() => void deliver()} disabled={busy}>
            {picked.length === 1 && !body.trim() ? "Open conversation" : `Deliver to ${picked.length}`}
          </Button>
        </>
      )}
    </div>
  );
}
