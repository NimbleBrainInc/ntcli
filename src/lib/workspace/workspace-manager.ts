import { ConfigManager, LocalWorkspace } from '../config-manager.js';
import { ManagementClient } from '../api/management-client.js';

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
   * Get authenticated API client for workspace operations
   */
  async getAuthenticatedClient(workspaceId?: string): Promise<{ client: ManagementClient; workspaceId: string } | null> {
    // Use provided workspace ID or active workspace
    const targetWorkspaceId = workspaceId || this.configManager.getActiveWorkspace()?.workspace_id;
    
    if (!targetWorkspaceId) {
      return null;
    }

    // Create client with simple auth provider
    const client = new ManagementClient();

    // Try to get and set workspace token if available
    const token = this.configManager.getWorkspaceToken(targetWorkspaceId);
    if (token) {
      client.setWorkspaceToken(token);
    }

    return { client, workspaceId: targetWorkspaceId };
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