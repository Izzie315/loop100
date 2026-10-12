import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  kind: z.enum(["note", "loop", "call"]),
  id: z.string().uuid(),
});

type Alert = { title: string; body: string; tag: string; kind: string };

async function pushTo(accountIds: string[], alert: Alert) {
  if (accountIds.length === 0) return;
  const raw = process.env.VAPID_PRIVATE_JWK;
  if (!raw) return;
  const privateJWK = JSON.parse(raw);
  const { buildPushHTTPRequest } = await import("@pushforge/builder");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("push_endpoints")
    .select("endpoint, p256dh, auth_key")
    .in("account_id", accountIds);
  await Promise.all(
    (rows ?? []).map(async (r) => {
      try {
        const req = await buildPushHTTPRequest({
          privateJWK,
          subscription: { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth_key } },
          message: {
            payload: alert,
            adminContact: "mailto:alerts@talkloop.app",
            options: { urgency: "high", ttl: alert.kind === "call" ? 60 : 86400 },
          },
        });
        const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_endpoints").delete().eq("endpoint", r.endpoint);
        }
      } catch (e) {
        console.error("push failed", e);
      }
    }),
  );
}

export const raiseAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    const who = me ? `${me.first_name} ${me.last_name}`.trim() : "Someone";

    const preview = (body: string | null, hasMedia: boolean) =>
      body?.trim() ? body.trim().slice(0, 140) : hasMedia ? "Attachment" : "New note";

    if (data.kind === "note") {
      const { data: n } = await supabase
        .from("notes")
        .select("author_id, addressee_id, body, media_url")
        .eq("id", data.id)
        .maybeSingle();
      if (!n || n.author_id !== userId || n.addressee_id === userId) return { ok: false };
      await pushTo([n.addressee_id], {
        title: who,
        body: preview(n.body, !!n.media_url),
        tag: `note-${userId}`,
        kind: "note",
      });
    } else if (data.kind === "loop") {
      const { data: n } = await supabase
        .from("group_notes")
        .select("author_id, group_id, body, media_url")
        .eq("id", data.id)
        .maybeSingle();
      if (!n || n.author_id !== userId) return { ok: false };
      const [{ data: g }, { data: members }] = await Promise.all([
        supabase.from("groups").select("name").eq("id", n.group_id).maybeSingle(),
        supabase.from("group_members").select("member_id").eq("group_id", n.group_id),
      ]);
      const ids = (members ?? []).map((m) => m.member_id).filter((id) => id !== userId);
      await pushTo(ids, {
        title: g?.name ? `${who} · ${g.name}` : who,
        body: preview(n.body, !!n.media_url),
        tag: `loop-${n.group_id}`,
        kind: "note",
      });
    } else {
      const { data: c } = await supabase
        .from("calls")
        .select("caller_id, callee_id, status")
        .eq("id", data.id)
        .maybeSingle();
      if (!c || c.caller_id !== userId || c.status !== "ringing") return { ok: false };
      await pushTo([c.callee_id], {
        title: `${who} is calling`,
        body: "Tap to open TalkLoop and answer",
        tag: `call-${data.id}`,
        kind: "call",
      });
    }
    return { ok: true };
  });
