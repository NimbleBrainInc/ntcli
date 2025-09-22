import { ConfigManager, LocalWorkspace } from '../config-manager.js';
import { ManagementClient } from '../api/management-client.js';
import { TokenManager } from '../auth/token-manager.js';

/**
 * Workspace Manager - Handles workspace operations using unified configuration
 */
export class WorkspaceManager {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Get the currently active workspace
   */
  async getActiveWorkspace(): Promise<LocalWorkspace | null> {
    return this.configManager.getActiveWorkspace();
  }

  /**
   * Get all workspaces
   */
  async getAllWorkspaces(): Promise<LocalWorkspace[]> {
    return this.configManager.getAllWorkspaces();
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string): Promise<LocalWorkspace | null> {
    return this.configManager.getWorkspace(workspaceId);
  }

  /**
   * Get workspace by name
   */
  async getWorkspaceByName(workspaceName: string): Promise<LocalWorkspace | null> {
    return this.configManager.getWorkspaceByName(workspaceName);
  }

  /**
   * Set active workspace
   */
  async setActiveWorkspace(workspaceId: string): Promise<boolean> {
    return this.configManager.setActiveWorkspace(workspaceId);
  }

  /**
   * Check if workspace exists locally
   */
  async hasWorkspace(workspaceId: string): Promise<boolean> {
    return this.configManager.hasWorkspace(workspaceId);
  }

  /**
   * Get workspace count
   */
  async getWorkspaceCount(): Promise<number> {
    return this.configManager.getWorkspaceCount();
  }

  /**
   * Get workspace names
   */
  async getWorkspaceNames(): Promise<string[]> {
    return this.configManager.getWorkspaceNames();
  }

  /**
   * Get authenticated API client for control plane operations (api.* endpoints)
   * Uses Clerk JWT for authentication
   */
  async getAuthenticatedClient(workspaceId?: string): Promise<{ client: ManagementClient; workspaceId: string } | null> {
    // Use provided workspace ID or active workspace
    const targetWorkspaceId = workspaceId || this.configManager.getActiveWorkspace()?.workspace_id;

    if (!targetWorkspaceId) {
      return null;
    }

    // Create client for control plane operations
    const client = new ManagementClient();

    // Control plane (api.*) always uses Clerk JWT
    const tokenManager = new TokenManager();
    const clerkIdToken = await tokenManager.getValidClerkIdToken();
    if (clerkIdToken) {
      client.setClerkJwtToken(clerkIdToken);
    }

    return { client, workspaceId: targetWorkspaceId };
  }

  /**
   * Get workspace token for data plane operations (mcp.* endpoints)
   * Returns the workspace-specific token created via 'token create/refresh'
   */
  getWorkspaceToken(workspaceId?: string): string | null {
    const targetWorkspaceId = workspaceId || this.configManager.getActiveWorkspace()?.workspace_id;

    if (!targetWorkspaceId) {
      return null;
    }

    return this.configManager.getWorkspaceToken(targetWorkspaceId);
  }

  /**
   * Check if workspace has a valid token
   */
  hasValidToken(workspaceId: string): boolean {
    return this.configManager.isWorkspaceTokenValid(workspaceId);
  }

  /**
   * Get workspace token expiration info
   */
  getTokenExpirationInfo(workspaceId: string): { expiresAt: Date; isExpired: boolean; minutesRemaining: number } | null {
    return this.configManager.getTokenExpirationInfo(workspaceId);
  }
}