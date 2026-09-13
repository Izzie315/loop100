import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, isValidNumber } from "@/lib/talkloop";

export function NumberSettings({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile, refreshProfile } = useAuth();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(profile?.talkloop_number ?? "");
  }, [open, profile]);

  const save = async () => {
    if (!profile) return;
    if (!isValidNumber(value)) {
      toast.error("Enter a full 10-digit TalkLoop number.");
      return;
    }
    const next = formatNumber(value);
    if (next === profile.talkloop_number) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ talkloop_number: next })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "That number is already taken. Try another."
          : "Could not update your number.",
      );
      return;
    }
    await refreshProfile();
    toast.success("Your TalkLoop number was updated.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your TalkLoop number</DialogTitle>
          <DialogDescription>
            Pick any free 10-digit number. Anyone who saved your old number will need the new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="own-number">TalkLoop number</Label>
          <Input
            id="own-number"
            inputMode="numeric"
            className="font-mono"
            value={value}
            onChange={(e) => setValue(formatNumber(e.target.value))}
            placeholder="(317) 555-0142"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
