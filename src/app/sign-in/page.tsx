import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string; sent?: string };
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
        <SignInForm next={searchParams.next} sent={searchParams.sent === "1"} />
      </div>
    </main>
  );
}
