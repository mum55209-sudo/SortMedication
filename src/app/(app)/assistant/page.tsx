import { AssistantChat } from "@/components/AssistantChat";
import { assistantConfigured } from "@/lib/assistant";
import { requireContext } from "@/lib/session";

export default async function AssistantPage() {
  const ctx = await requireContext();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ask AI</h1>
          <p className="subtitle">
            Ask questions about {ctx.branch.name}&apos;s stock, like what&apos;s running low or what expires soon. Answers come from
            Google Gemini, which only sees inventory, never patient details. Always double-check before acting.
          </p>
        </div>
      </div>
      {!assistantConfigured() && (
        <p className="warning">
          The AI assistant isn&apos;t switched on yet. The pharmacy needs a Gemini key first (see &quot;AI assistant&quot; in the README).
        </p>
      )}
      <AssistantChat />
    </>
  );
}
