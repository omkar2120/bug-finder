export type IntegrationProvider = "jira" | "github" | "slack";

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  createIssue?(input: { title: string; description: string; projectKey?: string }): Promise<{ issueId: string; issueUrl: string }>;
  notify?(input: { message: string; channel?: string }): Promise<void>;
}

/**
 * Phase 9 integration architecture. Adapters are selected by environment
 * configuration and must never receive secrets from test credentials.
 */
export class IntegrationsService {
  adapters: IntegrationAdapter[] = [];

  register(adapter: IntegrationAdapter) {
    this.adapters.push(adapter);
  }

  async exportBug(provider: IntegrationProvider, input: { title: string; description: string }) {
    const adapter = this.adapters.find((item) => item.provider === provider);
    if (!adapter?.createIssue) {
      throw new Error(`${provider} integration is configured architecturally but not connected yet.`);
    }
    return adapter.createIssue(input);
  }
}

export const integrationsService = new IntegrationsService();
