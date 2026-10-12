import { supabase } from "@/integrations/supabase/client";
import { raiseAlert } from "@/lib/alerts.functions";

export const VAPID_PUBLIC =
  "BEMdFFgD8xSgFemW-NaDKGxImHcuBUyYL9paHI-WH-8i7G2ZrtXWabFiM5f8h4HFRvYiN4f3bxJIh6uGcfs7qqE";

export function alertsSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Registers the device for alerts and stores its endpoint for this account. */
export async function enableAlerts(accountId: string) {
  const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC),
    }));
  const j = sub.toJSON();
  await supabase.from("push_endpoints").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_endpoints").insert({
    endpoint: sub.endpoint,
    account_id: accountId,
    p256dh: j.keys?.p256dh ?? "",
    auth_key: j.keys?.auth ?? "",
  });
  if (error) throw error;
}

/** Re-saves this device's existing registration (e.g. after signing in again). */
export async function refreshAlerts(accountId: string) {
  if (!alertsSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  const j = sub.toJSON();
  await supabase.from("push_endpoints").upsert({
    endpoint: sub.endpoint,
    account_id: accountId,
    p256dh: j.keys?.p256dh ?? "",
    auth_key: j.keys?.auth ?? "",
  });
  return true;
}

/** Fire-and-forget: notify the other side(s). Never blocks delivery. */
export function notifyParty(kind: "note" | "loop" | "call", id: string) {
  void raiseAlert({ data: { kind, id } }).catch(() => {});
}
