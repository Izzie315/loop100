export type PublicProfile = {
  id: string;
  first_name: string;
  last_name: string;
  talkloop_number: string;
};

export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats up to 10 digits as a standard phone number: (317) 555-0142 */
export function formatNumber(value: string): string {
  const d = digitsOf(value).slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isValidNumber(value: string): boolean {
  const d = digitsOf(value);
  return d.length === 10 && d[0] !== "0" && d[0] !== "1";
}

export function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

export function initialsOf(p: { first_name: string; last_name: string }): string {
  return `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function durationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
