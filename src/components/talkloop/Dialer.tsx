import { useState } from "react";
import { Delete, Phone } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { digitsOf, formatNumber, fullName, type PublicProfile } from "@/lib/talkloop";

const KEYS = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""],
];

export function Dialer() {
  const { startCall } = useCall();
  const [value, setValue] = useState("");
  const [match, setMatch] = useState<PublicProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const digits = digitsOf(value);

  const press = (key: string) => {
    if (digits.length >= 10) return;
    setValue(formatNumber(value + key));
    setMatch(null);
  };

  const lookup = async (): Promise<PublicProfile | null> => {
    const { data } = await supabase.rpc("lookup_by_number", { _number: digits });
    return ((data as PublicProfile[] | null) ?? [])[0] ?? null;
  };

  const dial = async () => {
    if (digits.length !== 10 || busy) return;
    setBusy(true);
    const found = await lookup();
    setBusy(false);
    if (!found) {
      toast.error("No TalkLoop account has that number.");
      return;
    }
    setMatch(found);
    await startCall(found);
  };

  return (
    <div className="flex flex-col items-center gap-6 pb-4">
      <div className="h-16 text-center">
        <p className="font-mono text-3xl tracking-wider text-foreground">
          {value || <span className="text-muted-foreground">Enter number</span>}
        </p>
        {match && <p className="mt-1 text-sm text-primary">{fullName(match)}</p>}
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map(([key, letters]) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key!)}
            className="flex aspect-square flex-col items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground transition-colors active:bg-accent"
          >
            <span className="font-mono text-2xl leading-none">{key}</span>
            {letters && (
              <span className="mt-1 text-[9px] tracking-[0.18em] text-muted-foreground">
                {letters}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex w-full max-w-xs items-center justify-between">
        <Button
          size="icon"
          className="glow-ring h-16 w-16 rounded-full"
          onClick={() => void dial()}
          disabled={digits.length !== 10 || busy}
          aria-label="Call"
        >
          <Phone className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => setValue(formatNumber(digits.slice(0, -1)))}
          disabled={!digits}
          aria-label="Delete"
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
