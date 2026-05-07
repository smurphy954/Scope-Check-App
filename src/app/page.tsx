import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // "Auto-open last project": jump to the most recently opened active project,
  // or to the project list if none / multiple recent.
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_project_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.last_project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, archived_at")
      .eq("id", profile.last_project_id)
      .maybeSingle();
    if (project && !project.archived_at) {
      redirect(`/projects/${project.id}`);
    }
  }

  redirect("/projects");
}
