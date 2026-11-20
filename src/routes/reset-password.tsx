import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Captured at import time: the auth client consumes the reset link out of the
// address bar as soon as it boots, so this page must read it first.
const INITIAL_HASH = typeof window === "undefined" ? "" : window.location.hash;

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your TalkLoop password — Calls & Notes" },
      {
        name: "description",
        content:
          "Choose a new password for your TalkLoop account and get back to your calls and notes.",
      },
      { property: "og:title", content: "Reset your TalkLoop password" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Pick a new password and get back to your calls and notes.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

type Stage = "checking" | "ready" | "saving" | "done" | "expired";

function isRecoveryHash(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("type") === "recovery";
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isRecoveryHash(INITIAL_HASH)) {
      setStage("expired");
      return;
    }

    // Trust the locally stored session: it is what the recovery link hands over,
    // and reading it needs no round trip, so a slow connection can't wrongly
    // tell someone their fresh link is dead.
    const settle = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setStage(data.session ? "ready" : "expired");
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") settle();
      if (event === "SIGNED_OUT") {
        if (!cancelled) setStage("expired");
      }
    });

    // The link may already have been consumed before this page mounted.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStage("ready");
        return;
      }
      window.setTimeout(() => {
        if (!cancelled) setStage((current) => (current === "checking" ? "expired" : current));
      }, 2500);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Those two passwords don't match.");
      return;
    }
    setStage("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStage("ready");
      toast.error("Could not update your password. Ask for a fresh link.");
      return;
    }
    setStage("done");
    toast.success("Your password is updated.");
  };

  const requestAgain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requesting) return;
    setRequesting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setRequesting(false);
    if (error) {
      toast.error("Could not deliver that reset link.");
      return;
    }
    toast.success("Check your email for a reset link.");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] tracking-[0.45em] text-primary">TALKLOOP</p>
          <h1 className="mt-3 text-3xl font-bold">
            {stage === "done" ? "You're all set" : "Choose a new password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {stage === "done"
              ? "Your new password is saved and you're signed in."
              : stage === "expired"
                ? "This reset link is no longer valid. Ask for a fresh one."
                : "Your new password needs at least 6 characters."}
          </p>
        </div>

        {stage === "checking" && (
          <div className="panel p-5 text-sm text-muted-foreground">Checking your reset link…</div>
        )}

        {(stage === "ready" || stage === "saving") && (
          <form onSubmit={save} className="panel space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted"
                minLength={6}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-muted"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={stage === "saving"}>
              {stage === "saving" ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}

        {stage === "done" && (
          <div className="panel space-y-4 p-5">
            <Button
              type="button"
              className="h-11 w-full"
              onClick={() => void navigate({ to: "/" })}
            >
              Open TalkLoop
            </Button>
          </div>
        )}

        {stage === "expired" && (
          <form onSubmit={requestAgain} className="panel space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted"
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={requesting}>
              {requesting ? "Delivering…" : "Deliver reset link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full"
              onClick={() => void navigate({ to: "/auth" })}
            >
              Back to sign in
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
