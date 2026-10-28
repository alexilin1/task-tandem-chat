import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, jsonSchema } from "ai";
import { createLovableAiGatewayRunIdFetch } from "@/lib/ai/run-id";

export const AGENT_MODEL = "openai/gpt-6-astra";

export interface AgentAction {
  type: "create_task" | "update_task" | "request_approval" | "save_memory" | "handoff" | "respond_handoff";
  handoff_id: string | null;
  handoff_response: "accept" | "reject" | "clarify" | "complete" | "fail" | null;
  title: string | null;
  description: string | null;
  assignee_handle: string | null;
  task_id: string | null;
  status: "pending" | "running" | "waiting_input" | "completed" | "failed" | null;
  progress: number | null;
  result: string | null;
  approval_action: string | null;
}
export interface AgentOutput {
  message: string;
  actions: AgentAction[];
}

const nullableStr: { type: ("string" | "null")[] } = { type: ["string", "null"] };
const schema = jsonSchema<AgentOutput>(({
  type: "object",
  additionalProperties: false,
  required: ["message", "actions"],
  properties: {
    message: { type: "string", description: "Chat message to post. Use @Handle to address other agents. Empty string to stay silent." },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "description", "assignee_handle", "task_id", "status", "progress", "result", "approval_action", "handoff_id", "handoff_response"],
        properties: {
          type: { type: "string", enum: ["create_task", "update_task", "request_approval", "save_memory", "handoff", "respond_handoff"] },
          handoff_id: nullableStr,
          handoff_response: { type: ["string", "null"], enum: ["accept", "reject", "clarify", "complete", "fail", null] },
          title: nullableStr,
          description: nullableStr,
          assignee_handle: nullableStr,
          task_id: nullableStr,
          status: { type: ["string", "null"], enum: ["pending", "running", "waiting_input", "completed", "failed", null] },
          progress: { type: ["integer", "null"] },
          result: nullableStr,
          approval_action: { type: ["string", "null"], description: "Sensitive action needing human approval" },
        },
      },
    },
  },
}) as any);

function gateway() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY)");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
}

/**
 * Picks the single best-suited agent handle for a message, or null when no
 * agent is a good fit. Used only when the keyword heuristic can't decide.
 */
export async function pickAgentWithLLM(roster: string, content: string): Promise<string | null> {
  const provider = gateway();
  const result = streamText({
    model: provider.responses(AGENT_MODEL),
    instructions: `You route a chat message to at most one agent. Reply with ONLY the exact handle of the best-suited agent, or "none" if the message is small talk, rhetorical, or no agent fits. Never explain.\nAgents:\n${roster}`,
    messages: [{ role: "user", content }],
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
  });
  const text = (await result.text).trim().replace(/^@/, "");
  return text.toLowerCase() === "none" || !text ? null : text;
}

export async function runAgentLLM(instructions: string, input: string) {
  const provider = gateway();
  const result = streamText({
    model: provider.responses(AGENT_MODEL),
    instructions,
    messages: [{ role: "user", content: input }],
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const output = (await result.output) as AgentOutput;
  const usage = await result.totalUsage;
  return { output, tokens: usage.totalTokens ?? 0 };
}
