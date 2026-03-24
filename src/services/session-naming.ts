const MAX_TITLE_LENGTH = 60;

export function extractShortId(instanceId: string): string {
  return instanceId.slice(-8);
}

export function sanitizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function generateSessionTitle(
  instanceId: string,
  phase: string,
): string {
  const shortId = extractShortId(instanceId);
  const sanitizedPhase = sanitizeTitle(phase);
  const prefix = "cc-";
  const separator = "-";
  const suffix = `${separator}${sanitizedPhase}`;

  const raw = `${prefix}${shortId}${suffix}`;
  if (raw.length <= MAX_TITLE_LENGTH) {
    return raw;
  }

  // Truncate shortId to fit within limit
  const available = MAX_TITLE_LENGTH - prefix.length - suffix.length;
  const truncatedId = shortId.slice(0, Math.max(1, available));
  return `${prefix}${truncatedId}${suffix}`;
}

export function getSessionPrefix(instanceId: string): string {
  const shortId = extractShortId(instanceId);
  return `cc-${shortId}`;
}
