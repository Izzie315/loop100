import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { alertsSupported, enableAlerts, isInstalled, refreshAlerts } from "@/lib/alerts";

export function AlertsToggle() {
  const { profile } = useAuth();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void refreshAlerts(profile.id).then(setOn).catch(() => {});
  }, [profile]);

  const turnOn = async () => {
    if (!profile) return;
    if (!alertsSupported()) {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      toast.error(
        ios && !isInstalled()
          ? "On iPhone, first tap Share → Add to Home Screen, then open TalkLoop from that icon."
          : "This browser can't show TalkLoop alerts.",
      );
      return;
    }
    setBusy(true);
    try {
      await enableAlerts(profile.id);
      setOn(true);
      toast.success("Alerts are on for this device.");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === "denied"
          ? "Alerts are blocked. Allow them in Settings → Notifications → TalkLoop."
          : "Couldn't turn on alerts here.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-9 w-9 shrink-0 rounded-full md:mt-4 ${on ? "text-primary" : "text-muted-foreground"}`}
      onClick={() => void turnOn()}
      disabled={busy}
      aria-label={on ? "Alerts are on" : "Turn on alerts"}
      title={on ? "Alerts are on" : "Turn on alerts"}
    >
      {on ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
    </Button>
  );
}
