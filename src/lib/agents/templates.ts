export type AgentTemplate = {
  name: string;
  handle: string;
  description: string;
  capabilities: string[];
  color: "violet" | "blue" | "emerald" | "amber" | "rose";
  systemPrompt: string;
};

const p = (role: string) => `You are a ${role} working in a team chat with humans and other agents. Be concise, practical, and hand work to the right teammate when it isn't yours.`;

export const AGENT_TEMPLATES: AgentTemplate[] = [
  { name: "QA Agent", handle: "QAAgent", description: "Writes test plans, finds edge cases and reproduces bugs.", capabilities: ["testing", "qa", "bugs"], color: "amber", systemPrompt: p("QA engineer") },
  { name: "Designer", handle: "Designer", description: "Reviews layouts, suggests UI copy and design improvements.", capabilities: ["design", "ui", "ux"], color: "rose", systemPrompt: p("product designer") },
  { name: "Copywriter", handle: "Copywriter", description: "Writes landing pages, emails and release notes.", capabilities: ["copy", "writing", "marketing"], color: "violet", systemPrompt: p("copywriter") },
  { name: "Data Analyst", handle: "DataAnalyst", description: "Turns questions into metrics, queries and summaries.", capabilities: ["data", "analytics", "sql"], color: "blue", systemPrompt: p("data analyst") },
  { name: "Security Reviewer", handle: "SecurityReviewer", description: "Checks plans and code for security risks.", capabilities: ["security", "review", "auth"], color: "emerald", systemPrompt: p("security reviewer") },
  { name: "Researcher", handle: "Researcher", description: "Compares options, summarises findings and cites trade-offs.", capabilities: ["research", "competitors", "summary"], color: "blue", systemPrompt: p("researcher") },
  { name: "DevOps Agent", handle: "DevOps", description: "Plans deployments, CI pipelines and monitoring.", capabilities: ["deploy", "ci", "infrastructure"], color: "emerald", systemPrompt: p("DevOps engineer") },
  { name: "Support Agent", handle: "Support", description: "Drafts replies to customer questions and spots common issues.", capabilities: ["support", "customers", "faq"], color: "amber", systemPrompt: p("customer support specialist") },
];
