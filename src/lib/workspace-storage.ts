import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CreateWorkspaceResponse, WorkspaceInfo } from '../types/index.js';

/**
 * Local workspace information for CLI
 */
export interface LocalWorkspace {
  workspace_id: string;
  workspace_name: string;
  access_token: string;
  token_type: string;
  expires_at: number;
  scope: string[];
  isActive?: boolean;
}

/**
 * Workspace storage configuration
 */
export interface WorkspaceConfig {
  activeWorkspaceId?: string;
  workspaces: Record<string, LocalWorkspace>;
  lastUpdated: string;
}

/**
 * Manages local workspace storage and switching
 */
export class WorkspaceStorage {
  private configDir: string;
  private workspacesFile: string;

  constructor() {
    this.configDir = join(homedir(), '.nimbletools');
    this.workspacesFile = join(this.configDir, 'workspaces.json');
    this.ensureConfigDir();
  }

  /**
   * Ensure the config directory exists
   */
  private ensureConfigDir(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load workspace configuration from file
   */
  private loadConfig(): WorkspaceConfig {
    if (!existsSync(this.workspacesFile)) {
      return {
        workspaces: {},
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      const configJson = readFileSync(this.workspacesFile, 'utf8');
      return JSON.parse(configJson) as WorkspaceConfig;
    } catch (error) {
      // If file is corrupted, start fresh
      return {
        workspaces: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Save workspace configuration to file
   */
  private saveConfig(config: WorkspaceConfig): void {
    config.lastUpdated = new Date().toISOString();
    const configJson = JSON.stringify(config, null, 2);
    writeFileSync(this.workspacesFile, configJson, { mode: 0o600 });
  }

  /**
   * Add a workspace from API response
   */
  addWorkspace(response: CreateWorkspaceResponse): void {
    const config = this.loadConfig();
    
    // Calculate token expiration timestamp
    const expiresAt = Date.now() + (response.expires_in * 1000);
    
    const workspace: LocalWorkspace = {
      workspace_id: response.workspace_id,
      workspace_name: response.workspace_name,
      access_token: response.access_token,
      token_type: response.token_type,
      expires_at: expiresAt,
      scope: response.scope
    };

    config.workspaces[response.workspace_id] = workspace;
    this.saveConfig(config);
  }


  /**
   * Remove a workspace
   */
  removeWorkspace(workspaceId: string): void {
    const config = this.loadConfig();
    
    delete config.workspaces[workspaceId];
    
    // If this was the active workspace, clear active workspace
    if (config.activeWorkspaceId === workspaceId) {
      delete config.activeWorkspaceId;
    }
    
    this.saveConfig(config);
  }

  /**
   * Set active workspace
   */
  setActiveWorkspace(workspaceId: string): boolean {
    const config = this.loadConfig();
    
    if (!config.workspaces[workspaceId]) {
      return false; // Workspace doesn't exist
    }
    
    // Clear isActive flag from all workspaces
    Object.values(config.workspaces).forEach(ws => {
      ws.isActive = false;
    });
    
    // Set new active workspace
    config.activeWorkspaceId = workspaceId;
    config.workspaces[workspaceId].isActive = true;
    
    this.saveConfig(config);
    return true;
  }

  /**
   * Get active workspace
   */
  getActiveWorkspace(): LocalWorkspace | null {
    const config = this.loadConfig();
    
    if (!config.activeWorkspaceId) {
      return null;
    }
    
    return config.workspaces[config.activeWorkspaceId] || null;
  }

  /**
   * Get all workspaces
   */
  getAllWorkspaces(): LocalWorkspace[] {
    const config = this.loadConfig();
    return Object.values(config.workspaces);
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(workspaceId: string): LocalWorkspace | null {
    const config = this.loadConfig();
    return config.workspaces[workspaceId] || null;
  }

  /**
   * Get workspace by name
   */
  getWorkspaceByName(workspaceName: string): LocalWorkspace | null {
    const config = this.loadConfig();
    return Object.values(config.workspaces).find(
      ws => ws.workspace_name === workspaceName
    ) || null;
  }

  /**
   * Get all workspace names
   */
  getWorkspaceNames(): string[] {
    const config = this.loadConfig();
    return Object.values(config.workspaces).map(ws => ws.workspace_name);
  }

  /**
   * Get all workspace IDs
   */
  getWorkspaceIds(): string[] {
    const config = this.loadConfig();
    return Object.keys(config.workspaces);
  }

  /**
   * Update workspace access token (if retrieved later)
   */
  updateWorkspaceToken(workspaceId: string, accessToken: string, tokenType: string, expiresIn: number, scope: string[]): boolean {
    const config = this.loadConfig();
    
    if (!config.workspaces[workspaceId]) {
      return false;
    }
    
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    config.workspaces[workspaceId].access_token = accessToken;
    config.workspaces[workspaceId].token_type = tokenType;
    config.workspaces[workspaceId].expires_at = expiresAt;
    config.workspaces[workspaceId].scope = scope;
    this.saveConfig(config);
    return true;
  }

  /**
   * Check if workspace token is valid (not expired)
   */
  isWorkspaceTokenValid(workspaceId: string): boolean {
    const config = this.loadConfig();
    const workspace = config.workspaces[workspaceId];
    
    if (!workspace || !workspace.access_token) {
      return false;
    }
    
    // Check if token is expired (with 5 minute buffer)
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return workspace.expires_at > (Date.now() + bufferMs);
  }

  /**
   * Get valid workspace token
   */
  getWorkspaceToken(workspaceId: string): string | null {
    if (!this.isWorkspaceTokenValid(workspaceId)) {
      return null;
    }
    
    const workspace = this.getWorkspace(workspaceId);
    return workspace ? workspace.access_token : null;
  }


  /**
   * Check if workspace exists locally
   */
  hasWorkspace(workspaceId: string): boolean {
    const config = this.loadConfig();
    return workspaceId in config.workspaces;
  }

  /**
   * Get workspace count
   */
  getWorkspaceCount(): number {
    const config = this.loadConfig();
    return Object.keys(config.workspaces).length;
  }

  /**
   * Get workspace token expiration info
   */
  getTokenExpirationInfo(workspaceId: string): { expiresAt: Date; isExpired: boolean; minutesRemaining: number } | null {
    const workspace = this.getWorkspace(workspaceId);
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

  /**
   * Clear active workspace (unset all active workspaces)
   */
  clearActiveWorkspace(): boolean {
    const config = this.loadConfig();
    
    // Clear isActive flag from all workspaces
    Object.values(config.workspaces).forEach(ws => {
      ws.isActive = false;
    });
    
    // Clear active workspace ID
    delete config.activeWorkspaceId;
    
    this.saveConfig(config);
    return true;
  }
}