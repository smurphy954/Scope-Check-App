import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <main className="min-h-dvh">
      <AppHeader
        title="Settings"
        back={{ href: "/projects" }}
        showSettings={false}
      />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-4">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Profile
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="truncate font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">About</h2>
          <p className="mt-2 text-sm">
            Scope Check — job site submittal & compliance assistant.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            API keys are configured server-side. You don&apos;t need to enter
            anything here.
          </p>
        </section>

        <form action="/auth/sign-out" method="post">
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            className="w-full"
          >
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
