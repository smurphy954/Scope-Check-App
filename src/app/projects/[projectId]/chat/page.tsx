import { ComingSoon } from "@/components/coming-soon";

export default function ChatPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <ComingSoon
      title="Chat"
      projectId={params.projectId}
      phase="Phase 6"
      description="Ask questions grounded in this project's documents. Every answer cites the source PDF and page."
    />
  );
}
