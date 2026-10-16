import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { appearanceOf, type Mode } from "@/lib/appearance";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("tl-theme");
    setMode(appearanceOf(saved));
  }, []);

  const flip = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    window.localStorage.setItem("tl-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={flip}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
