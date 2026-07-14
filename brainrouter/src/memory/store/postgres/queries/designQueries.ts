import type { Executor } from "./executor.js";
import type { DesignArtifactRecord } from "../../../../design/store.js";

function mapArtifact(row: any): DesignArtifactRecord {
  return {
    userId: String(row.user_id),
    flowId: String(row.flow_id),
    screenId: String(row.screen_id),
    artifact: row.artifact,
    updatedAt: String(row.updated_at),
  };
}

export async function getDesignArtifact(exec: Executor, userId: string, flowId: string, screenId: string): Promise<DesignArtifactRecord | null> {
  const row = await exec.one<any>(
    `SELECT user_id, flow_id, screen_id, artifact, updated_at
       FROM design_artifacts WHERE user_id = $1 AND flow_id = $2 AND screen_id = $3`,
    [userId, flowId, screenId],
  );
  return row ? mapArtifact(row) : null;
}

export async function upsertDesignArtifact(exec: Executor, record: DesignArtifactRecord): Promise<DesignArtifactRecord> {
  const row = await exec.one<any>(
    `INSERT INTO design_artifacts (user_id, flow_id, screen_id, artifact, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (user_id, flow_id, screen_id)
     DO UPDATE SET artifact = EXCLUDED.artifact, updated_at = EXCLUDED.updated_at
     RETURNING user_id, flow_id, screen_id, artifact, updated_at`,
    [record.userId, record.flowId, record.screenId, JSON.stringify(record.artifact), record.updatedAt],
  );
  return mapArtifact(row);
}

export async function deleteDesignArtifact(exec: Executor, userId: string, flowId: string, screenId: string): Promise<void> {
  await exec.run(`DELETE FROM design_artifacts WHERE user_id = $1 AND flow_id = $2 AND screen_id = $3`, [userId, flowId, screenId]);
}
