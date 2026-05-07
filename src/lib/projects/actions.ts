"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required.")
    .max(120, "Keep the name under 120 characters."),
});

export async function createProject(formData: FormData) {
  const parsed = CreateProjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name.trim(), owner_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create project." };
  }

  await supabase
    .from("profiles")
    .update({ last_project_id: data.id })
    .eq("id", user.id);

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function archiveProject(projectId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { ok: true };
}

export async function unarchiveProject(projectId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { ok: true };
}

export async function setLastProject(projectId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ last_project_id: projectId })
    .eq("id", user.id);
}
