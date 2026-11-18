import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  digitsOf,
  formatNumber,
  fullName,
  initialsOf,
  isValidNumber,
  type PublicProfile,
} from "@/lib/talkloop";

/** Start a conversation with anyone, by TalkLoop number or by name. */
export function NewNoteStarter({ onPick }: { onPick: (party: PublicProfile) => void }) {
  const { account } = useAuth();
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
    onPick(found);
  };

  return (
    <div>
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
                      onPick(m);
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
}
