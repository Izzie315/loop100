import { useCallback, useEffect, useState } from "react";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  callDuration,
  durationLabel,
  fullName,
  stampLabel,
  type PublicProfile,
} from "@/lib/talkloop";

type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
};

export function HistoryPanel() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<CallRow[]>([]);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("calls")
      .select("id, caller_id, callee_id, status, created_at, answered_at, ended_at")
      .or(`caller_id.eq.${profile.id},callee_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data ?? []) as CallRow[];
    setRows(list);
    const ids = Array.from(
      new Set(list.map((r) => (r.caller_id === profile.id ? r.callee_id : r.caller_id))),
    );
    if (ids.length === 0) return;
    const { data: profiles } = await supabase.rpc("get_profiles_public", { _ids: ids });
    const map: Record<string, PublicProfile> = {};
    for (const p of ((profiles as PublicProfile[] | null) ?? [])) map[p.id] = p;
    setPeople(map);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-3 text-base font-semibold">Recent calls</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls yet.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {rows.map((r) => {
            const outgoing = r.caller_id === profile.id;
            const other = people[outgoing ? r.callee_id : r.caller_id];
            const secs = callDuration(r.answered_at, r.ended_at);
            const missed = !r.answered_at;
            const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary"
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${missed ? "text-destructive" : "text-primary"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {other ? fullName(other) : "Unknown"}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {other?.talkloop_number ?? ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-muted-foreground">{stampLabel(r.created_at)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {missed ? "Missed" : secs === null ? "—" : durationLabel(secs)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
