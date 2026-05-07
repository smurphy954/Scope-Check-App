import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppHeader({
  title,
  back,
  className,
  showSettings = true,
}: {
  title: string;
  back?: { href: string; label?: string };
  className?: string;
  showSettings?: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {back ? (
          <Link
            href={back.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {back.label ?? "Back"}
          </Link>
        ) : null}
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </div>
      {showSettings ? (
        <Link
          href="/settings"
          aria-label="Settings"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </Link>
      ) : null}
    </header>
  );
}
