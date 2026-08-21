import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { digitsOf, formatNumber, isValidNumber } from "@/lib/talkloop";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to TalkLoop — Calls & Notes" },
      {
        name: "description",
        content:
          "Create your TalkLoop account, claim your own TalkLoop number, and start calling instantly.",
      },
      { property: "og:title", content: "Sign in to TalkLoop" },
      {
        property: "og:description",
        content: "Claim your TalkLoop number and start calling instantly.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { account, loading } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && account) void navigate({ to: "/" });
  }, [account, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) toast.error("Could not sign in. Check your details.");
      else void navigate({ to: "/" });
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setBusy(false);
      toast.error("First and last name are required.");
      return;
    }
    if (!isValidNumber(number)) {
      setBusy(false);
      toast.error("Choose a valid 10-digit TalkLoop number.");
      return;
    }

    const { data: taken } = await supabase.rpc("lookup_by_number", { _number: digitsOf(number) });
    if ((taken as unknown[] | null)?.length) {
      setBusy(false);
      toast.error("That TalkLoop number is already taken.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setBusy(false);
      toast.error("Could not create your account.");
      return;
    }

    const newAccount = data.user;
    if (data.session && newAccount) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: newAccount.id,
        email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        talkloop_number: formatNumber(number),
      });
      setBusy(false);
      if (profileError) toast.error("Could not save your profile. Try another number.");
      else void navigate({ to: "/" });
      return;
    }

    setBusy(false);
    window.localStorage.setItem(
      "talkloop_pending_profile",
      JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        talkloop_number: formatNumber(number),
      }),
    );
    toast.success("Check your email to confirm your TalkLoop account.");
  };

  const googleSignIn = async () => {
    if (mode === "signup" && isValidNumber(number) && firstName && lastName) {
      window.localStorage.setItem(
        "talkloop_pending_profile",
        JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          talkloop_number: formatNumber(number),
        }),
      );
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] tracking-[0.45em] text-primary">TALKLOOP</p>
          <h1 className="mt-3 text-3xl font-bold">
            {mode === "signup" ? "Claim your number" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Pick a TalkLoop number and start calling."
              : "Sign in to pick up where you left off."}
          </p>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-5">
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first">First name</Label>
                  <Input
                    id="first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-muted"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last">Last name</Label>
                  <Input
                    id="last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-muted"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="number">Your TalkLoop number</Label>
                <Input
                  id="number"
                  inputMode="numeric"
                  value={number}
                  onChange={(e) => setNumber(formatNumber(e.target.value))}
                  placeholder="(317) 555-0142"
                  className="bg-muted font-mono"
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-muted"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted"
              minLength={6}
              required
            />
          </div>

          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full"
            onClick={() => void googleSignIn()}
          >
            Continue with Google
          </Button>

          <p className="pt-1 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already on TalkLoop?" : "New here?"}{" "}
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}
