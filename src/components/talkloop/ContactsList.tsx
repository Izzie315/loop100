import { NotebookPen, Phone, Trash2, Users as GroupIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { fullName, initialsOf, type PublicProfile } from "@/lib/talkloop";

export function ContactsList({
  contacts,
  onChanged,
  onNote,
}: {
  contacts: PublicProfile[];
  onChanged: () => void;
  onNote: (party: PublicProfile) => void;
}) {
  const { account } = useAuth();
  const { startCall } = useCall();

  const remove = async (id: string) => {
    if (!account) return;
    await supabase.from("contacts").delete().eq("owner_id", account.id).eq("contact_id", id);
    onChanged();
  };

  const sections = contacts.reduce<Record<string, PublicProfile[]>>((acc, c) => {
    const letter = (c.first_name[0] ?? "#").toUpperCase();
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
                    {initialsOf(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(c)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{c.talkloop_number}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full"
                    onClick={() => onNote(c)}
                    aria-label={`Leave a note for ${fullName(c)}`}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => void startCall(c)}
                    aria-label={`Call ${fullName(c)}`}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full text-muted-foreground"
                    onClick={() => void remove(c.id)}
                    aria-label={`Remove ${fullName(c)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
