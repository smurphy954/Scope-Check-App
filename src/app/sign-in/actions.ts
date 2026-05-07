"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SignInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  next: z.string().optional(),
});

export async function sendMagicLink(formData: FormData) {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const next = parsed.data.next || "/projects";
  const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}
