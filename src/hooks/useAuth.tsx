import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User as Account } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  talkloop_number: string;
};

type AuthValue = {
  account: Account | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAccount(nextSession?.user ?? null);
      if (!nextSession) setProfile(null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAccount(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("profiles")
      .select("id, email, first_name, last_name, talkloop_number")
      .eq("id", account.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as Profile | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  const refreshProfile = async () => {
    if (!account) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, talkloop_number")
      .eq("id", account.id)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ account, session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
