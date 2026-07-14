import type { DesignFlow } from "./studioTypes";

export const DESIGN_FLOWS: DesignFlow[] = [
  {
    id: "workspace-onboarding",
    name: "Workspace onboarding",
    description: "Guide a new team from invite to their first shared workspace.",
    screens: [
      { id: "welcome", name: "Welcome", route: "/welcome", kind: "dashboard", description: "A calm entry point with a clear next step.", status: "ready", x: 80, y: 120 },
      { id: "invite-team", name: "Invite team", route: "/invite", kind: "form", description: "Collect teammates and set workspace permissions.", status: "ready", x: 410, y: 120 },
      { id: "workspace", name: "Workspace", route: "/workspace", kind: "dashboard", description: "The first useful view after onboarding.", status: "draft", x: 740, y: 120 },
      { id: "activity", name: "Activity", route: "/activity", kind: "list", description: "Recent actions and team momentum.", status: "draft", x: 740, y: 400 },
    ],
    connectors: [
      { from: "welcome", to: "invite-team", label: "Continue" },
      { from: "invite-team", to: "workspace", label: "Create workspace" },
      { from: "workspace", to: "activity", label: "View activity" },
    ],
  },
  {
    id: "memory-review",
    name: "Memory review",
    description: "Review, refine, and reinforce the most useful memories.",
    screens: [
      { id: "memory-home", name: "Memory home", route: "/memories", kind: "dashboard", description: "A high-signal overview of remembered context.", status: "ready", x: 140, y: 180 },
      { id: "memory-list", name: "Memory list", route: "/memories/all", kind: "list", description: "Filter and inspect remembered facts.", status: "draft", x: 500, y: 180 },
      { id: "memory-detail", name: "Memory detail", route: "/memories/:id", kind: "detail", description: "Trace sources, confidence, and related knowledge.", status: "draft", x: 860, y: 180 },
    ],
    connectors: [
      { from: "memory-home", to: "memory-list", label: "Explore" },
      { from: "memory-list", to: "memory-detail", label: "Inspect" },
    ],
  },
];
