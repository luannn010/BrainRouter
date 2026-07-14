import { Router } from "express";
import { memoryEngine } from "../../memory/engine.js";
import { modelGateway } from "../../services/modelGateway/modelGateway.js";
import { sendError } from "../../contracts/http.js";
import { requireAnyAuth, type AuthedRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/tenancy.js";
import { z } from "zod";

export const designRouter = Router();
designRouter.use(requireAnyAuth, requirePermission("providers:manage"));

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const artifactSchema = z.object({
  variant: z.enum(["default", "spacious", "prominent", "empty"]),
  instruction: z.string().max(4000),
  updatedAt: z.string().max(64),
});

function artifactKeys(req: AuthedRequest) {
  return { flowId: text(req.body?.flowId ?? req.query.flowId, 160), screenId: text(req.body?.screenId ?? req.query.screenId, 160) };
}

designRouter.get("/artifact", async (req: AuthedRequest, res) => {
  const { flowId, screenId } = artifactKeys(req);
  if (!flowId || !screenId) { sendError(res, 400, "flowId and screenId are required"); return; }
  const artifact = await memoryEngine.design.getDesignArtifact(req.userId!, flowId, screenId);
  res.json({ artifact });
});

designRouter.put("/artifact", async (req: AuthedRequest, res) => {
  const { flowId, screenId } = artifactKeys(req);
  if (!flowId || !screenId) { sendError(res, 400, "flowId and screenId are required"); return; }
  try {
    const artifact = artifactSchema.parse(req.body?.artifact);
    const saved = await memoryEngine.design.upsertDesignArtifact({ userId: req.userId!, flowId, screenId, artifact, updatedAt: new Date().toISOString() });
    res.json({ artifact: saved });
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Invalid design artifact");
  }
});

designRouter.delete("/artifact", async (req: AuthedRequest, res) => {
  const { flowId, screenId } = artifactKeys(req);
  if (!flowId || !screenId) { sendError(res, 400, "flowId and screenId are required"); return; }
  await memoryEngine.design.deleteDesignArtifact(req.userId!, flowId, screenId);
  res.json({ ok: true });
});

designRouter.post("/generate", async (req: AuthedRequest, res) => {
  const flowName = text(req.body?.flowName, 160);
  const screenName = text(req.body?.screenName, 160);
  const route = text(req.body?.route, 240);
  const screenDescription = text(req.body?.screenDescription, 500);
  const prompt = text(req.body?.prompt, 4000);
  const model = text(req.body?.model, 160) || undefined;

  if (!flowName || !screenName || !prompt) {
    sendError(res, 400, "flowName, screenName, and prompt are required");
    return;
  }

  try {
    const output = await modelGateway.chat("llm", {
      model,
      maxTokens: 900,
      timeoutMs: 120_000,
      label: "design-studio",
      messages: [
        {
          role: "system",
          content: "You are BrainRouter Design Studio, a senior web product designer. Help edit one UI screen at a time. Give a concise, actionable design response with: intent, visual changes, interaction details, and implementation notes. Do not invent changes outside the selected screen.",
        },
        {
          role: "user",
          content: JSON.stringify({ flow: flowName, screen: screenName, route, screenDescription, instruction: prompt }),
        },
      ],
    });
    res.json({ ok: true, model: model ?? "provider default", output });
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : "Design model request failed");
  }
});
