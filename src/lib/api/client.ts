// Re-export the new separated clients
export { ManagementApiError, ManagementClient } from './management-client.js';
export { MCPRuntimeClient, MCPRuntimeError } from './mcp-runtime-client.js';

import { ManagementClient } from './management-client.js';
import { MCPRuntimeClient } from './mcp-runtime-client.js';
import { Config } from '../config.js';

/**
 * @deprecated Use ManagementClient for management operations or MCPRuntimeClient for MCP operations
 * This class is kept for backward compatibility but delegates to the separated clients
 */
export class NimbleBrainApiClient {
  private managementClient: ManagementClient;
  private mcpClient: MCPRuntimeClient;

  constructor(
    managementBaseUrl: string = process.env.NTCLI_MANAGEMENT_API_URL || "https://api.nimbletools.ai",
    mcpBaseUrl: string = process.env.NTCLI_MCP_API_URL || "https://mcp.nimbletools.ai"
  ) {
    this.managementClient = new ManagementClient(managementBaseUrl);
    this.mcpClient = new MCPRuntimeClient(mcpBaseUrl);
  }

  /**
   * Get the management API base URL
   */
  getManagementBaseUrl(): string {
    return this.managementClient.getBaseUrl();
  }

  /**
   * Get the MCP runtime base URL  
   */
  getMcpBaseUrl(): string {
    return this.mcpClient.getBaseUrl();
  }

  /**
   * Set Clerk JWT token for workspace operations
   */
  setClerkJwtToken(token: string): void {
    this.managementClient.setClerkJwtToken(token);
  }

  /**
   * Set workspace access token for resource operations
   */
  setWorkspaceToken(token: string): void {
    this.managementClient.setWorkspaceToken(token);
    this.mcpClient.setWorkspaceToken(token);
  }

  /**
   * Clear authentication headers
   */
  clearAuth(): void {
    this.managementClient.clearAuth();
    this.mcpClient.clearAuth();
  }

  // Delegate all management operations to ManagementClient
  async createWorkspace(request: any) { return this.managementClient.createWorkspace(request); }
  async listWorkspaces() { return this.managementClient.listWorkspaces(); }
  async getWorkspace(workspaceId: string) { return this.managementClient.getWorkspace(workspaceId); }
  async deleteWorkspace(workspaceId: string) { return this.managementClient.deleteWorkspace(workspaceId); }
  async generateWorkspaceToken(workspaceId: string, options?: any) { return this.managementClient.generateWorkspaceToken(workspaceId, options); }
  async revokeWorkspaceToken(workspaceId: string, jti: string) { return this.managementClient.revokeWorkspaceToken(workspaceId, jti); }
  async refreshWorkspaceToken(workspaceId: string, options?: any) { return this.managementClient.refreshWorkspaceToken(workspaceId, options); }
  async listWorkspaceTokens(workspaceId: string) { return this.managementClient.listWorkspaceTokens(workspaceId); }
  async activateWorkspace(workspaceId: string) { return this.managementClient.activateWorkspace(workspaceId); }
  async listRegistryServers(filters?: any) { return this.managementClient.listRegistryServers(filters); }
  async getRegistryServer(serverId: string) { return this.managementClient.getRegistryServer(serverId); }
  async deployServer(workspaceId: string, request: any) { return this.managementClient.deployServer(workspaceId, request); }
  async listWorkspaceServers(workspaceId: string) { return this.managementClient.listWorkspaceServers(workspaceId); }
  async getWorkspaceServer(workspaceId: string, serverId: string) { return this.managementClient.getWorkspaceServer(workspaceId, serverId); }
  async scaleServer(workspaceId: string, serverId: string, request: any) { return this.managementClient.scaleServer(workspaceId, serverId, request); }
  async removeServer(workspaceId: string, serverId: string) { return this.managementClient.removeServer(workspaceId, serverId); }
  async getServerLogs(workspaceId: string, serverId: string, request?: any) { return this.managementClient.getServerLogs(workspaceId, serverId, request); }
  async listWorkspaceSecrets(workspaceId: string) { return this.managementClient.listWorkspaceSecrets(workspaceId); }
  async setWorkspaceSecret(workspaceId: string, secretKey: string, request: any) { return this.managementClient.setWorkspaceSecret(workspaceId, secretKey, request); }
  async deleteWorkspaceSecret(workspaceId: string, secretKey: string) { return this.managementClient.deleteWorkspaceSecret(workspaceId, secretKey); }

  // Delegate MCP operations to MCPRuntimeClient
  getMcpEndpoint(workspaceId: string, serverId: string): string {
    return this.mcpClient.getMcpEndpoint(workspaceId, serverId);
  }
  
  getHealthEndpoint(workspaceId: string, serverId: string): string {
    return this.mcpClient.getHealthEndpoint(workspaceId, serverId);
  }
  
  async checkHealth(workspaceId: string, serverId: string) {
    return this.mcpClient.checkHealth(workspaceId, serverId);
  }
}

// Re-export ApiError for backward compatibility
export { ManagementApiError as ApiError } from './management-client.js';
