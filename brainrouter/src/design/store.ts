/** Persistence contract for user-scoped Design Studio screen artifacts. */
export interface DesignArtifactRecord {
  userId: string;
  flowId: string;
  screenId: string;
  artifact: unknown;
  updatedAt: string;
}

export interface DesignStore {
  getDesignArtifact(userId: string, flowId: string, screenId: string): Promise<DesignArtifactRecord | null>;
  upsertDesignArtifact(record: DesignArtifactRecord): Promise<DesignArtifactRecord>;
  deleteDesignArtifact(userId: string, flowId: string, screenId: string): Promise<void>;
}
