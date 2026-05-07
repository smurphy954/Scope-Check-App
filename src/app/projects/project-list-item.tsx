"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ChevronRight, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveProject, unarchiveProject } from "@/lib/projects/actions";

type Project = {
  id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
};

export function ProjectListItem({
  project,
  archived,
}: {
  project: Project;
  archived: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      if (archived) {
        await unarchiveProject(project.id);
      } else {
        await archiveProject(project.id);
      }
    });
  }

  return (
    <li className="flex items-stretch overflow-hidden rounded-lg border bg-card">
      <Link
        href={`/projects/${project.id}`}
        className="flex flex-1 items-center justify-between gap-3 px-4 py-4 hover:bg-accent"
      >
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label={archived ? "Unarchive project" : "Archive project"}
        onClick={toggleArchive}
        disabled={isPending}
        className="shrink-0 rounded-none border-l"
      >
        {archived ? (
          <RotateCcw className="h-4 w-4" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
      </Button>
    </li>
  );
}
