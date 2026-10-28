import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg border bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      {description && <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
