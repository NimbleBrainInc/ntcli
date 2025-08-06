import { WorkspaceStorage, LocalWorkspace } from '../workspace-storage.js';
import { NimbleBrainApiClient } from '../api/client.js';
import { TokenManager } from '../auth/token-manager.js';

/**
 * Workspace Manager - Wrapper around WorkspaceStorage for convenience
 */
export class WorkspaceManager {
  private storage: WorkspaceStorage;

  constructor() {
    this.storage = new WorkspaceStorage();
  }

  /**
   * Get the currently active workspace
   */
  async getActiveWorkspace(): Promise<LocalWorkspace | null> {
    return this.storage.getActiveWorkspace();
  }

  /**
   * Get all workspaces
   */
  async getAllWorkspaces(): Promise<LocalWorkspace[]> {
    return this.storage.getAllWorkspaces();
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string): Promise<LocalWorkspace | null> {
    return this.storage.getWorkspace(workspaceId);
  }

  /**
   * Get workspace by name
   */
  async getWorkspaceByName(workspaceName: string): Promise<LocalWorkspace | null> {
    return this.storage.getWorkspaceByName(workspaceName);
  }

  /**
   * Set active workspace
   */
  async setActiveWorkspace(workspaceId: string): Promise<boolean> {
    return this.storage.setActiveWorkspace(workspaceId);
  }

  /**
   * Check if workspace exists locally
   */
  async hasWorkspace(workspaceId: string): Promise<boolean> {
    return this.storage.hasWorkspace(workspaceId);
  }

  /**
   * Get workspace count
   */
  async getWorkspaceCount(): Promise<number> {
    return this.storage.getWorkspaceCount();
  }

  /**
   * Get workspace names
   */
  async getWorkspaceNames(): Promise<string[]> {
    return this.storage.getWorkspaceNames();
  }

  /**
   * Get authenticated API client for workspace operations
   */
  async getAuthenticatedClient(workspaceId?: string): Promise<{ client: NimbleBrainApiClient; workspaceId: string } | null> {
    // Use provided workspace ID or active workspace
    const targetWorkspaceId = workspaceId || this.storage.getActiveWorkspace()?.workspace_id;
    
    if (!targetWorkspaceId) {
      return null;
    }

    // Check if we have a valid token for this workspace
    const token = this.storage.getWorkspaceToken(targetWorkspaceId);
    
    if (token) {
      // Use existing valid token
      const client = new NimbleBrainApiClient();
      client.setWorkspaceToken(token);
      return { client, workspaceId: targetWorkspaceId };
    }

    // If no valid token, we need to create a new workspace (which gives us a token)
    // or the user needs to switch to a workspace that has a valid token
    return null;
  }

  /**
   * Check if workspace has a valid token
   */
  hasValidToken(workspaceId: string): boolean {
    return this.storage.isWorkspaceTokenValid(workspaceId);
  }

  /**
   * Get workspace token expiration info
   */
  getTokenExpirationInfo(workspaceId: string): { expiresAt: Date; isExpired: boolean; minutesRemaining: number } | null {
    const workspace = this.storage.getWorkspace(workspaceId);
    if (!workspace || !workspace.access_token) {
      return null;
    }

    const expiresAt = new Date(workspace.expires_at);
    const now = new Date();
    const isExpired = expiresAt.getTime() <= now.getTime();
    const minutesRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    return {
      expiresAt,
      isExpired,
      minutesRemaining: Math.max(0, minutesRemaining)
    };
  }
}