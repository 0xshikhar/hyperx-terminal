import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertBellProps = {
  count?: number;
};

export function AlertBell({ count = 0 }: AlertBellProps) {
  return (
    <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground">
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
