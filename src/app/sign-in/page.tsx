import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string; sent?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/projects");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Scope Check</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your email — we&apos;ll send you a magic link.
          </p>
        </div>
        {searchParams.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">Couldn&apos;t sign you in.</p>
            <p className="mt-1 break-words">
              {searchParams.error === "missing_code"
                ? "The sign-in link was missing its code. Try requesting a new magic link."
                : searchParams.error}
            </p>
          </div>
        )}
        <SignInForm next={searchParams.next} sent={searchParams.sent === "1"} />
      </div>
    </main>
  );
}
