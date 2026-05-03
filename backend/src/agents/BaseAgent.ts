import { AgentTrace } from '../types/index.js';

export abstract class BaseAgent {
  readonly id: string;
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  log(
    step: string,
    message: string,
    metadata: Record<string, unknown> | undefined,
    timestamp: number,
    externalMetadata?: Record<string, unknown>
  ): AgentTrace {
    const mergedMetadata = this.mergeMetadata(metadata, externalMetadata);

    return {
      agent: this.name,
      step,
      message,
      metadata: mergedMetadata,
      timestamp,
    };
  }

  private mergeMetadata(
    metadata: Record<string, unknown> | undefined,
    externalMetadata: Record<string, unknown> | undefined
  ): Record<string, unknown> | undefined {
    if (!metadata && !externalMetadata) {
      return undefined;
    }

    const merged: Record<string, unknown> = { ...(metadata ?? {}) };

    if (externalMetadata) {
      for (const [key, value] of Object.entries(externalMetadata)) {
        if (merged[key] === undefined) {
          merged[key] = value;
        }
      }
    }

    return merged;
  }
}
