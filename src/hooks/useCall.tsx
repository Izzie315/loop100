import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PublicProfile } from "@/lib/talkloop";

export type CallPhase = "idle" | "dialing" | "incoming" | "active" | "ending";

type CallValue = {
  phase: CallPhase;
  peer: PublicProfile | null;
  callId: string | null;
  muted: boolean;
  seconds: number;
  startCall: (peer: PublicProfile) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  hangUp: () => Promise<void>;
  toggleMute: () => void;
};

const CallContext = createContext<CallValue | null>(null);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [peer, setPeer] = useState<PublicProfile | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const roleRef = useRef<"caller" | "callee" | null>(null);
  const callIdRef = useRef<string | null>(null);

  const setActiveCall = (id: string | null) => {
    callIdRef.current = id;
    setCallId(id);
  };

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    pendingIce.current = [];
    roleRef.current = null;
    setActiveCall(null);
    setPeer(null);
    setMuted(false);
    setSeconds(0);
    setPhase("idle");
  }, []);

  const sendSignal = useCallback(
    async (kind: string, payload: unknown) => {
      if (!user || !callIdRef.current) return;
      await supabase.from("call_signals").insert({
        call_id: callIdRef.current,
        sender_id: user.id,
        kind,
        payload: payload as never,
      });
    },
    [user],
  );

  const buildPeerConnection = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal("ice", event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      if (!audioRef.current) {
        const el = document.createElement("audio");
        el.autoplay = true;
        document.body.appendChild(el);
        audioRef.current = el;
      }
      audioRef.current.srcObject = event.streams[0] ?? null;
      void audioRef.current.play().catch(() => undefined);
    };
    pcRef.current = pc;
    return pc;
  }, [sendSignal]);

  const startCall = useCallback(
    async (target: PublicProfile) => {
      if (!user || phase !== "idle") return;
      if (target.id === user.id) {
        toast.error("You can't dial your own TalkLoop number.");
        return;
      }
      setPeer(target);
      setPhase("dialing");
      roleRef.current = "caller";

      const { data, error } = await supabase
        .from("calls")
        .insert({ caller_id: user.id, callee_id: target.id, status: "ringing" })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Could not place the call.");
        cleanup();
        return;
      }
      setActiveCall(data.id);

      try {
        const pc = await buildPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal("offer", { sdp: offer.sdp, type: offer.type });
      } catch {
        toast.error("Microphone access is required to make a call.");
        await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", data.id);
        cleanup();
      }
    },
    [user, phase, buildPeerConnection, sendSignal, cleanup],
  );

  const acceptCall = useCallback(async () => {
    if (!user || !callIdRef.current) return;
    roleRef.current = "callee";
    try {
      const pc = await buildPeerConnection();
      const { data: offers } = await supabase
        .from("call_signals")
        .select("payload")
        .eq("call_id", callIdRef.current)
        .eq("kind", "offer")
        .order("created_at", { ascending: false })
        .limit(1);

      const offer = offers?.[0]?.payload as RTCSessionDescriptionInit | undefined;
      if (!offer) {
        toast.error("The caller hung up.");
        cleanup();
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingIce.current) await pc.addIceCandidate(candidate);
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal("answer", { sdp: answer.sdp, type: answer.type });
      await supabase.from("calls").update({ status: "active" }).eq("id", callIdRef.current);
      setPhase("active");
    } catch {
      toast.error("Microphone access is required to answer.");
      cleanup();
    }
  }, [user, buildPeerConnection, sendSignal, cleanup]);

  const endWithStatus = useCallback(
    async (status: "declined" | "ended") => {
      const id = callIdRef.current;
      setPhase("ending");
      if (id) {
        await supabase
          .from("calls")
          .update({ status, ended_at: new Date().toISOString() })
          .eq("id", id);
      }
      cleanup();
    },
    [cleanup],
  );

  const declineCall = useCallback(() => endWithStatus("declined"), [endWithStatus]);
  const hangUp = useCallback(() => endWithStatus("ended"), [endWithStatus]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  /* Incoming calls + call status changes */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`tl-calls-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as { id: string; caller_id: string; status: string };
          if (row.status !== "ringing" || callIdRef.current) return;
          const { data } = await supabase.rpc("get_profiles_public", { _ids: [row.caller_id] });
          const caller = (data as PublicProfile[] | null)?.[0];
          if (!caller) return;
          setActiveCall(row.id);
          setPeer(caller);
          setPhase("incoming");
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          if (row.id !== callIdRef.current) return;
          if (row.status === "active" && roleRef.current === "caller") setPhase("active");
          if (row.status === "declined" || row.status === "ended") {
            if (row.status === "declined" && roleRef.current === "caller") {
              toast("Call declined");
            }
            cleanup();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, cleanup]);

  /* Signaling for the active call */
  useEffect(() => {
    if (!user || !callId) return;
    const channel = supabase
      .channel(`tl-signals-${callId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
        async (payload) => {
          const row = payload.new as { sender_id: string; kind: string; payload: unknown };
          if (row.sender_id === user.id) return;
          const pc = pcRef.current;
          if (row.kind === "answer" && pc) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(row.payload as RTCSessionDescriptionInit),
            );
            for (const candidate of pendingIce.current) await pc.addIceCandidate(candidate);
            pendingIce.current = [];
          }
          if (row.kind === "ice") {
            const candidate = row.payload as RTCIceCandidateInit;
            if (pc?.remoteDescription) await pc.addIceCandidate(candidate);
            else pendingIce.current.push(candidate);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, callId]);

  /* Call timer */
  useEffect(() => {
    if (phase !== "active") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      phase,
      peer,
      callId,
      muted,
      seconds,
      startCall,
      acceptCall,
      declineCall,
      hangUp,
      toggleMute,
    }),
    [phase, peer, callId, muted, seconds, startCall, acceptCall, declineCall, hangUp, toggleMute],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}
