import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Grid3x3, LogOut, NotebookPen, Users as GroupIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialer } from "@/components/talkloop/Dialer";
import { ContactsList } from "@/components/talkloop/ContactsList";
import { NotesPanel } from "@/components/talkloop/NotesPanel";
import { CallOverlay } from "@/components/talkloop/CallOverlay";
import { cn } from "@/lib/utils";
import { digitsOf, formatNumber, isValidNumber, type PublicProfile } from "@/lib/talkloop";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalkLoop — Live Calls on Your Own Number" },
      {
        name: "description",
        content:
          "TalkLoop gives every person their own number for instant voice calls, in-call notes, and notes that wait when someone can't pick up.",
      },
      { property: "og:title", content: "TalkLoop — Live Calls on Your Own Number" },
      {
        property: "og:description",
        content:
          "Dial any TalkLoop number, leave notes during a call, and keep an alphabetical contacts list.",
      },
    ],
  }),
  component: Index,
});

type Tab = "keypad" | "notes" | "contacts";

function Index() {
  const { account, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !account) void navigate({ to: "/auth" });
  }, [account, loading, navigate]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs tracking-[0.4em] text-primary">CONNECTING…</p>
      </main>
    );
  }

  if (!account) return null;
  if (!profile) return <Onboarding />;

  return <TalkLoopApp />;
}

function Onboarding() {
  const { account, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pending = window.localStorage.getItem("talkloop_pending_profile");
    if (!pending) return;
    try {
      const parsed = JSON.parse(pending) as {
        first_name: string;
        last_name: string;
        talkloop_number: string;
      };
      setFirstName(parsed.first_name);
      setLastName(parsed.last_name);
      setNumber(parsed.talkloop_number);
    } catch {
      /* ignore malformed cache */
    }
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || busy) return;
    if (!firstName.trim() || !lastName.trim() || !isValidNumber(number)) {
      toast.error("Enter your name and a valid 10-digit TalkLoop number.");
      return;
    }
    setBusy(true);
    const { data: taken } = await supabase.rpc("lookup_by_number", { _number: digitsOf(number) });
    if ((taken as unknown[] | null)?.length) {
      setBusy(false);
      toast.error("That TalkLoop number is already taken.");
      return;
    }
    const { error } = await supabase.from("profiles").insert({
      id: account.id,
      email: account.email ?? "",
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      talkloop_number: formatNumber(number),
    });
    setBusy(false);
    if (error) {
      toast.error("Could not save your profile. Try another number.");
      return;
    }
    window.localStorage.removeItem("talkloop_pending_profile");
    await refreshProfile();
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={save} className="panel w-full max-w-sm space-y-4 p-5">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-[0.45em] text-primary">TALKLOOP</p>
          <h1 className="mt-2 text-2xl font-bold">Finish your setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the number other people will dial.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ofirst">First name</Label>
            <Input
              id="ofirst"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="olast">Last name</Label>
            <Input
              id="olast"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-muted"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onumber">TalkLoop number</Label>
          <Input
            id="onumber"
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(formatNumber(e.target.value))}
            placeholder="(317) 555-0142"
            className="bg-muted font-mono"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          Activate my number
        </Button>
      </form>
    </main>
  );
}

function TalkLoopApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("keypad");
  const [contacts, setContacts] = useState<PublicProfile[]>([]);
  const [openParty, setOpenParty] = useState<PublicProfile | null>(null);

  const loadContacts = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("contacts")
      .select("contact_id")
      .eq("owner_id", profile.id);
    const ids = ((data ?? []) as { contact_id: string }[]).map((r) => r.contact_id);
    if (ids.length === 0) {
      setContacts([]);
      return;
    }
    const { data: profiles } = await supabase.rpc("get_profiles_public", { _ids: ids });
    const list = ((profiles as PublicProfile[] | null) ?? []).slice();
    list.sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
    );
    setContacts(list);
  }, [profile]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const tabs: { id: Tab; label: string; icon: typeof Grid3x3 }[] = [
    { id: "keypad", label: "Keypad", icon: Grid3x3 },
    { id: "notes", label: "Notes", icon: NotebookPen },
    { id: "contacts", label: "Contacts", icon: GroupIcon },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.45em] text-primary">TALKLOOP</p>
          <h1 className="text-lg font-semibold">{profile?.first_name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{profile?.talkloop_number}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full text-muted-foreground"
          onClick={() => void signOut()}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        {tab === "keypad" && <Dialer onSaved={() => void loadContacts()} />}
        {tab === "notes" && <NotesPanel openParty={openParty} setOpenParty={setOpenParty} />}
        {tab === "contacts" && (
          <ContactsList
            contacts={contacts}
            onChanged={() => void loadContacts()}
            onNote={(party: PublicProfile) => {
              setOpenParty(party);
              setTab("notes");
            }}
          />
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                if (id !== "notes") setOpenParty(null);
              }}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition-colors",
                tab === id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <CallOverlay />
    </main>
  );
}
