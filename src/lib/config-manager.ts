import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CreateWorkspaceResponse, UserInfo, NimbleBrainAuth } from '../types/index.js';

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
  jti?: string;
  isActive?: boolean;
}

/**
 * Unified configuration structure
 */
export interface UnifiedConfig {
  version: string;
  lastUpdated: string;

  // Domain configuration
  domain?: string; // Default: nimbletools.ai
  insecure?: boolean; // Default: false (use HTTPS)

  // Authentication
  auth?: NimbleBrainAuth;

  // Workspaces
  workspaces: {
    activeWorkspaceId?: string;
    items: Record<string, LocalWorkspace>;
  };
}

/**
 * Unified configuration manager that handles all CLI configuration in a single file
 */
export class ConfigManager {
  private configDir: string;
  private configFile: string;
  private config: UnifiedConfig | null = null;

  constructor() {
    this.configDir = join(homedir(), '.ntcli');
    this.configFile = join(this.configDir, 'config.json');
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
   * Load unified configuration from file
   */
  loadConfig(): UnifiedConfig {
    if (this.config) {
      return this.config;
    }

    if (!existsSync(this.configFile)) {
      this.config = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        workspaces: {
          items: {}
        }
      };
      this.saveConfig();
      return this.config;
    }

    try {
      const configJson = readFileSync(this.configFile, 'utf8');
      this.config = JSON.parse(configJson) as UnifiedConfig;
      return this.config;
    } catch {
      // If file is corrupted, start fresh
      this.config = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        workspaces: {
          items: {}
        }
      };
      this.saveConfig();
      return this.config;
    }
  }

  /**
   * Save unified configuration to file
   */
  private saveConfig(): void {
    if (!this.config) {
      return;
    }

    this.config.lastUpdated = new Date().toISOString();
    const configJson = JSON.stringify(this.config, null, 2);
    writeFileSync(this.configFile, configJson, { mode: 0o600 });
  }

  /**
   * Clear cached config (force reload)
   */
  clearCache(): void {
    this.config = null;
  }

  // Domain configuration methods

  /**
   * Set the domain for all API endpoints
   */
  setDomain(domain: string, insecure?: boolean): void {
    const config = this.loadConfig();
    // Clean the domain - remove protocol and trailing slash
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    config.domain = cleanDomain;
    if (insecure !== undefined) {
      config.insecure = insecure;
    }
    this.saveConfig();
  }

  /**
   * Get the configured domain (defaults to nimbletools.ai)
   */
  getDomain(): string {
    const config = this.loadConfig();
    return config.domain || 'nimbletools.ai';
  }

  /**
   * Get whether insecure (HTTP) mode is enabled
   */
  isInsecure(): boolean {
    const config = this.loadConfig();
    return config.insecure || false;
  }

  /**
   * Get the protocol to use (http or https)
   */
  private getProtocol(): string {
    const domain = this.getDomain();
    const insecure = this.isInsecure();

    // Always use HTTP for localhost, or if insecure flag is set
    if (domain.includes('localhost') || domain.includes('127.0.0.1') || insecure) {
      return 'http';
    }
    return 'https';
  }

  /**
   * Get the management API URL
   */
  getManagementApiUrl(): string {
    const domain = this.getDomain();
    const protocol = this.getProtocol();

    // For localhost, don't add api subdomain
    if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
      return `${protocol}://${domain}`;
    }
    return `${protocol}://api.${domain}`;
  }

  /**
   * Get the MCP runtime API URL
   */
  getMcpApiUrl(): string {
    const domain = this.getDomain();
    const protocol = this.getProtocol();

    // For localhost, don't add mcp subdomain
    if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
      return `${protocol}://${domain}`;
    }
    return `${protocol}://mcp.${domain}`;
  }

  /**
   * Get the Clerk authentication domain
   * Note: This is independent of the main domain and always defaults to nimblebrain.ai
   */
  getClerkDomain(): string {
    // Use environment variable if set
    if (process.env.CLERK_OAUTH_DOMAIN) {
      return process.env.CLERK_OAUTH_DOMAIN;
    }

    // Always use nimblebrain.ai for production Clerk, not derived from main domain
    return 'clerk.nimblebrain.ai';
  }

  /**
   * Get the Studio API URL (for token exchange)
   * Note: This is independent of the main domain and always defaults to nimblebrain.ai
   */
  getStudioApiUrl(): string {
    // Use environment variable if set
    if (process.env.NIMBLEBRAIN_API_URL) {
      return process.env.NIMBLEBRAIN_API_URL;
    }

    // Always use nimblebrain.ai for Studio API, not derived from main domain
    return 'https://studio-api.nimblebrain.ai';
  }

  // Authentication methods

  /**
   * Set NimbleBrain authentication
   */
  setAuth(auth: NimbleBrainAuth): void {
    const config = this.loadConfig();
    config.auth = auth;
    this.saveConfig();
  }

  /**
   * Get NimbleBrain bearer token
   */
  getBearerToken(): string | null {
    const config = this.loadConfig();
    if (!config.auth) return null;

    const now = Date.now();
    if (config.auth.expiresAt > now) {
      return config.auth.bearerToken;
    }
    return null; // Token expired
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    const config = this.loadConfig();
    if (!config.auth) return false;

    const now = Date.now();
    return config.auth.expiresAt > now;
  }

  /**
   * Get user info
   */
  getUserInfo(): UserInfo | null {
    const config = this.loadConfig();
    if (!config.auth) return null;

    return config.auth.user;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    const config = this.loadConfig();
    delete config.auth;
    this.saveConfig();
  }

  // Workspace methods

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
      scope: response.scope,
      ...(response.jti && { jti: response.jti })
    };

    config.workspaces.items[response.workspace_id] = workspace;
    this.saveConfig();
  }

  /**
   * Add a workspace without token
   */
  addWorkspaceWithoutToken(workspaceId: string, workspaceName: string): void {
    const config = this.loadConfig();

    const workspace: LocalWorkspace = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      access_token: 'no-token',
      token_type: 'none',
      expires_at: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year from now
      scope: ['none']
    };

    config.workspaces.items[workspaceId] = workspace;
    this.saveConfig();
  }

  /**
   * Remove a workspace
   */
  removeWorkspace(workspaceId: string): void {
    const config = this.loadConfig();

    delete config.workspaces.items[workspaceId];

    // If this was the active workspace, clear active workspace
    if (config.workspaces.activeWorkspaceId === workspaceId) {
      delete config.workspaces.activeWorkspaceId;
    }

    this.saveConfig();
  }

  /**
   * Set active workspace
   */
  setActiveWorkspace(workspaceId: string): boolean {
    const config = this.loadConfig();

    if (!config.workspaces.items[workspaceId]) {
      return false; // Workspace doesn't exist
    }

    // Clear isActive flag from all workspaces
    Object.values(config.workspaces.items).forEach(ws => {
      ws.isActive = false;
    });

    // Set new active workspace
    config.workspaces.activeWorkspaceId = workspaceId;
    config.workspaces.items[workspaceId].isActive = true;

    this.saveConfig();
    return true;
  }

  /**
   * Get active workspace
   */
  getActiveWorkspace(): LocalWorkspace | null {
    const config = this.loadConfig();

    if (!config.workspaces.activeWorkspaceId) {
      return null;
    }

    return config.workspaces.items[config.workspaces.activeWorkspaceId] || null;
  }

  /**
   * Get all workspaces
   */
  getAllWorkspaces(): LocalWorkspace[] {
    const config = this.loadConfig();
    return Object.values(config.workspaces.items);
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(workspaceId: string): LocalWorkspace | null {
    const config = this.loadConfig();
    return config.workspaces.items[workspaceId] || null;
  }

  /**
   * Get workspace by name
   */
  getWorkspaceByName(workspaceName: string): LocalWorkspace | null {
    const config = this.loadConfig();
    return Object.values(config.workspaces.items).find(
      ws => ws.workspace_name === workspaceName
    ) || null;
  }

  /**
   * Update workspace token
   */
  updateWorkspaceToken(workspaceId: string, accessToken: string, tokenType: string, expiresIn: number, scope: string[], jti?: string): boolean {
    const config = this.loadConfig();

    if (!config.workspaces.items[workspaceId]) {
      return false;
    }

    const expiresAt = Date.now() + (expiresIn * 1000);

    config.workspaces.items[workspaceId].access_token = accessToken;
    config.workspaces.items[workspaceId].token_type = tokenType;
    config.workspaces.items[workspaceId].expires_at = expiresAt;
    config.workspaces.items[workspaceId].scope = scope;
    if (jti) {
      config.workspaces.items[workspaceId].jti = jti;
    }
    this.saveConfig();
    return true;
  }

  /**
   * Check if workspace token is valid (not expired)
   */
  isWorkspaceTokenValid(workspaceId: string): boolean {
    const config = this.loadConfig();
    const workspace = config.workspaces.items[workspaceId];

    if (!workspace || !workspace.access_token || workspace.access_token === 'no-token') {
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
   * Get workspace token expiration info
   */
  getTokenExpirationInfo(workspaceId: string): { expiresAt: Date; isExpired: boolean; minutesRemaining: number } | null {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace || !workspace.access_token || workspace.access_token === 'no-token') {
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
   * Check if workspace exists
   */
  hasWorkspace(workspaceId: string): boolean {
    const config = this.loadConfig();
    return workspaceId in config.workspaces.items;
  }

  /**
   * Get workspace count
   */
  getWorkspaceCount(): number {
    const config = this.loadConfig();
    return Object.keys(config.workspaces.items).length;
  }

  /**
   * Get workspace names
   */
  getWorkspaceNames(): string[] {
    const config = this.loadConfig();
    return Object.values(config.workspaces.items).map(ws => ws.workspace_name);
  }

  /**
   * Get workspace IDs
   */
  getWorkspaceIds(): string[] {
    const config = this.loadConfig();
    return Object.keys(config.workspaces.items);
  }

  /**
   * Clear active workspace
   */
  clearActiveWorkspace(): boolean {
    const config = this.loadConfig();

    // Clear isActive flag from all workspaces
    Object.values(config.workspaces.items).forEach(ws => {
      ws.isActive = false;
    });

    // Clear active workspace ID
    delete config.workspaces.activeWorkspaceId;

    this.saveConfig();
    return true;
  }
}