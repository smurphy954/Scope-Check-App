import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export function ComingSoon({
  title,
  projectId,
  phase,
  description,
}: {
  title: string;
  projectId: string;
  phase: string;
  description: string;
}) {
  return (
    <main className="min-h-dvh">
      <AppHeader
        title={title}
        back={{ href: `/projects/${projectId}`, label: "Project" }}
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {phase}
          </p>
          <h2 className="mt-2 text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <Link
            href={`/projects/${projectId}`}
            className="mt-6 inline-block text-sm font-medium underline"
          >
            Back to project
          </Link>
        </div>
      </div>
    </main>
  );
}
