import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { NewProjectButton } from "./new-project-button";
import { ProjectListItem } from "./project-list-item";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const showArchived = searchParams.archived === "1";

  const query = supabase
    .from("projects")
    .select("id, name, created_at, archived_at")
    .order("created_at", { ascending: false });

  const { data: projects, error } = showArchived
    ? await query.not("archived_at", "is", null)
    : await query.is("archived_at", null);

  return (
    <main className="min-h-dvh">
      <AppHeader title={showArchived ? "Archived projects" : "Projects"} />
      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <NewProjectButton />
          <Link
            href={showArchived ? "/projects" : "/projects?archived=1"}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {showArchived ? "Active" : "Archived"}
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t load projects: {error.message}
          </p>
        ) : !projects || projects.length === 0 ? (
          <EmptyState archived={showArchived} />
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <ProjectListItem
                key={p.id}
                project={p}
                archived={showArchived}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState({ archived }: { archived: boolean }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {archived
          ? "No archived projects."
          : "No projects yet. Create your first one to get started."}
      </p>
    </div>
  );
}
