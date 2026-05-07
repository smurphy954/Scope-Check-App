import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <Link
          href="/projects"
          className="mt-4 inline-block text-sm font-medium underline"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
