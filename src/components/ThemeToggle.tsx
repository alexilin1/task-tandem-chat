import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggle}
      aria-label="Toggle theme"
      className="h-9 w-9 rounded-full"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
