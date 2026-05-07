import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setLastProject } from "@/lib/projects/actions";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, archived_at")
    .eq("id", params.projectId)
    .maybeSingle();

  if (!project) notFound();

  // Track most recent project so the root route can auto-open it next session.
  await setLastProject(project.id);

  return <>{children}</>;
}
