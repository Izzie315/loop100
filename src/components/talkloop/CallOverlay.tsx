import { useState } from "react";
import { Mic, MicOff, MessageSquare, Phone, PhoneOff, X } from "lucide-react";

import { useCall } from "@/hooks/useCall";
import { Button } from "@/components/ui/button";
import { Thread } from "@/components/talkloop/Thread";
import { durationLabel, fullName, initialsOf } from "@/lib/talkloop";

export function CallOverlay() {
  const { phase, peer, muted, seconds, acceptCall, declineCall, hangUp, toggleMute } = useCall();
  const [texting, setTexting] = useState(false);

  if (phase === "idle" || !peer) return null;

  const statusLabel =
    phase === "dialing"
      ? "Calling…"
      : phase === "incoming"
        ? "Incoming TalkLoop call"
        : phase === "active"
          ? durationLabel(seconds)
          : "Ending…";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full bg-gradient-signal text-3xl font-bold text-primary-foreground ${
            phase === "active" ? "" : "pulse-ring"
          }`}
        >
          {initialsOf(peer)}
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{fullName(peer)}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{peer.talkloop_number}</p>
          <p className="mt-3 font-mono text-sm tracking-[0.2em] text-primary">{statusLabel}</p>
        </div>
      </div>

      {texting && phase === "active" && (
        <div className="panel mx-4 mb-4 flex h-80 flex-col p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs tracking-[0.2em] text-muted-foreground">IN-CALL TEXT</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTexting(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Thread peer={peer} />
        </div>
      )}

      <div className="flex items-center justify-center gap-5 px-6 pb-12">
        {phase === "incoming" ? (
          <>
            <Button
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() => void declineCall()}
              aria-label="Decline"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="icon"
              className="glow-ring h-16 w-16 rounded-full"
              onClick={() => void acceptCall()}
              aria-label="Answer"
            >
              <Phone className="h-6 w-6" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="secondary"
              className="h-14 w-14 rounded-full"
              onClick={toggleMute}
              disabled={phase !== "active"}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() => void hangUp()}
              aria-label="Hang up"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-14 w-14 rounded-full"
              onClick={() => setTexting((t) => !t)}
              disabled={phase !== "active"}
              aria-label="Text during call"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
