export type DesignChatHandoff = { mode: 'code'; prompt: string };

export function buildDesignChatHandoff(prompt: string): DesignChatHandoff | null {
  const trimmed = prompt.trim();
  return trimmed ? { mode: 'code', prompt: trimmed } : null;
}

