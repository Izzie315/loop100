export type Mode = "dark" | "light";
export const initialEntry = "signin";
export function appearanceOf(saved: string | null): Mode {
  return saved === "dark" ? "dark" : "light";
}