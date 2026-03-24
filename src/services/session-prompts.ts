const WORKFLOW_TOOLS: Record<string, string> = {
  "workflow.transition": "Fire a workflow transition event",
  "workflow.status": "Get current workflow state and context",
  "workflow.context": "Read workflow context values",
};

export function renderPreamble(
  instanceId: string,
  workflowTools: string[],
): string {
  const lines: string[] = [
    `Your workflow instance ID is: ${instanceId}`,
    `Set this in your environment: export WFE_INSTANCE_ID="${instanceId}"`,
    "",
    "Available workflow tools:",
  ];

  for (const tool of workflowTools) {
    const desc = WORKFLOW_TOOLS[tool] ?? tool;
    lines.push(`- ${tool}: ${desc}`);
  }

  return lines.join("\n");
}

export function assembleSessionPrompt(
  instanceId: string,
  phasePrompt: string,
  workflowTools: string[],
): string {
  const preamble = renderPreamble(instanceId, workflowTools);
  if (!phasePrompt) {
    return preamble;
  }
  return `${preamble}\n\n${phasePrompt}`;
}
