import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, FileText, MessageSquare, DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function ProjectHomePage({
  params,
}: {
  params: { projectId: string };
}) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, archived_at")
    .eq("id", params.projectId)
    .maybeSingle();

  if (!project) notFound();

  const tiles = [
    {
      label: "Camera",
      href: `/projects/${project.id}/camera`,
      icon: Camera,
      hint: "Capture an installed item",
      phase: "Phase 5",
    },
    {
      label: "Rooms",
      href: `/projects/${project.id}/rooms`,
      icon: DoorOpen,
      hint: "Per-room checklists",
      phase: "Phase 4",
    },
    {
      label: "Upload docs",
      href: `/projects/${project.id}/documents`,
      icon: FileText,
      hint: "Drawings, contracts, submittals",
      phase: "Phase 2",
    },
    {
      label: "Chat",
      href: `/projects/${project.id}/chat`,
      icon: MessageSquare,
      hint: "Ask questions about this project",
      phase: "Phase 6",
    },
  ];

  return (
    <main className="min-h-dvh">
      <AppHeader title={project.name} back={{ href: "/projects" }} />
      <div className="mx-auto max-w-2xl px-4 py-4">
        {project.archived_at && (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900">
            This project is archived.
          </div>
        )}
        <p className="mb-3 text-sm text-muted-foreground">Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className="group flex aspect-square flex-col justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-accent active:bg-accent/70"
              >
                <Icon className="h-7 w-7 text-foreground" />
                <div>
                  <p className="text-base font-semibold leading-tight">
                    {tile.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tile.hint}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {tile.phase}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
