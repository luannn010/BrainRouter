export type StudioTab = "canvas" | "design" | "brands";

export type ScreenKind = "dashboard" | "list" | "detail" | "form";

export interface FlowScreen {
  id: string;
  name: string;
  route: string;
  kind: ScreenKind;
  description: string;
  status: "ready" | "draft";
  x: number;
  y: number;
}

export interface FlowConnector {
  from: string;
  to: string;
  label: string;
}

export interface DesignFlow {
  id: string;
  name: string;
  description: string;
  screens: FlowScreen[];
  connectors: FlowConnector[];
}

export interface FlowPosition {
  x: number;
  y: number;
}

export const STUDIO_MODELS = [
  { id: "gpt-4.1", label: "GPT-4.1", note: "Balanced" },
  { id: "claude-sonnet", label: "Claude Sonnet", note: "Polished UI" },
  { id: "gemini-pro", label: "Gemini Pro", note: "Fast iteration" },
  { id: "local", label: "Local model", note: "Private" },
] as const;
