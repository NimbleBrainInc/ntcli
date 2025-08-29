import {
  ActivateWorkspaceResponse,
  ApiErrorResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteSecretResponse,
  DeployServerRequest,
  DeployServerResponse,
  GetRegistryServerResponse,
  GetWorkspaceServerResponse,
  ListRegistryServersResponse,
  ListSecretsResponse,
  ListWorkspaceServersResponse,
  ListWorkspacesResponse,
  ListWorkspaceTokensResponse,
  RefreshWorkspaceTokenResponse,
  RegistryServerFilters,
  RemoveServerResponse,
  ScaleServerRequest,
  ScaleServerResponse,
  ServerLogsRequest,
  ServerLogsResponse,
  SetSecretRequest,
  SetSecretResponse,
  WorkspaceDetails,
  AuthProvider,
} from "../../types/index.js";
import { AuthProviderFactory } from "../auth/auth-provider.js";
import { ConfigManager } from "../config-manager.js";

/**
 * HTTP client for NimbleTools Management API (api.nimbletools.dev)
 * Handles workspaces, tokens, secrets, registry, and server management operations
 */
export class ManagementClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private authProvider: AuthProvider;

  /**
   * Extract UUID from workspace ID
   * Converts "wootwoot-74e4f895-5c8a-4222-ac86-ae0885506202" to "74e4f895-5c8a-4222-ac86-ae0885506202"
   */
  private extractWorkspaceUuid(workspaceId: string): string {
    // If it's already just a UUID (contains only hyphens in UUID format), return as-is
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(workspaceId)) {
      return workspaceId;
    }

    // Extract UUID from the end of the workspace ID (after the last dash before UUID)
    const parts = workspaceId.split("-");
    if (parts.length >= 5) {
      // Take the last 5 parts which form the UUID (8-4-4-4-12 format)
      return parts.slice(-5).join("-");
    }

    // Fallback: return the original if we can't parse it
    return workspaceId;
  }

  constructor(
    baseUrl?: string,
    authProvider?: AuthProvider
  ) {
    // Use provided baseUrl, or get from config, or fall back to default
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      const configManager = new ConfigManager();
      this.baseUrl = configManager.getManagementApiUrl();
    }
    
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "ntcli/1.0.0",
    };
    
    // Use provided auth provider or create a simple one
    if (authProvider) {
      this.authProvider = authProvider;
    } else {
      this.authProvider = AuthProviderFactory.createProvider();
    }
  }

  /**
   * Get the management API base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set Clerk JWT token for workspace operations that require Clerk auth
   */
  setClerkJwtToken(token: string): void {
    this.authProvider.setToken(token);
  }

  /**
   * Set workspace token for operations that require workspace auth
   */
  setWorkspaceToken(token: string): void {
    this.authProvider.setToken(token);
  }

  /**
   * Clear authentication headers
   */
  clearAuth(): void {
    this.authProvider.clearAuth();
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any,
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const authHeaders = this.authProvider.getAuthHeaders();
    const headers = { ...this.defaultHeaders, ...authHeaders, ...customHeaders };

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      if (process.env.NTCLI_DEBUG) {
        console.error(`[DEBUG] ${method} ${url}`);
        console.error(`[DEBUG] Headers:`, headers);
        if (body) {
          console.error(`[DEBUG] Body:`, body);
        }
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();

      if (process.env.NTCLI_DEBUG) {
        console.error(`[DEBUG] Response Status:`, response.status);
        console.error(`[DEBUG] Response Body:`, responseText);
      }

      // Handle empty responses
      if (!responseText) {
        if (response.ok) {
          return {} as T;
        } else {
          throw new ManagementApiError(
            "Empty response from server",
            response.status
          );
        }
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        if (response.ok) {
          // If response is OK but not JSON, return the text as data
          return responseText as unknown as T;
        } else {
          throw new ManagementApiError(
            `Invalid JSON response: ${responseText}`,
            response.status
          );
        }
      }

      if (!response.ok) {
        // Try to extract error information from response
        const errorResponse = responseData as ApiErrorResponse;
        const errorMessage =
          errorResponse?.error?.message ||
          responseText ||
          `HTTP ${response.status}`;
        const errorCode = errorResponse?.error?.code || "UNKNOWN_ERROR";
        const errorDetails = errorResponse?.error?.details;

        throw new ManagementApiError(
          errorMessage,
          response.status,
          errorCode,
          errorDetails
        );
      }

      return responseData;
    } catch (error) {
      if (error instanceof ManagementApiError) {
        throw error;
      }

      // Handle network errors, timeout, etc.
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ManagementApiError(
          "Network error - unable to connect to the API",
          0,
          "NETWORK_ERROR"
        );
      }

      throw new ManagementApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        0,
        "UNKNOWN_ERROR"
      );
    }
  }

  // Workspace API methods

  /**
   * Create a new workspace
   */
  async createWorkspace(
    request: CreateWorkspaceRequest
  ): Promise<CreateWorkspaceResponse> {
    return this.makeRequest<CreateWorkspaceResponse>(
      "POST",
      "/v1/workspaces",
      request
    );
  }

  /**
   * List user workspaces
   */
  async listWorkspaces(): Promise<ListWorkspacesResponse> {
    return this.makeRequest<ListWorkspacesResponse>("GET", "/v1/workspaces");
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId: string): Promise<WorkspaceDetails> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<WorkspaceDetails>("GET", `/v1/workspaces/${uuid}`);
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<{ message: string }> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<{ message: string }>(
      "DELETE",
      `/v1/workspaces/${uuid}`
    );
  }

  // Token API methods

  /**
   * Generate new workspace token (requires Clerk JWT auth)
   */
  async generateWorkspaceToken(
    workspaceId: string,
    options: { expires_in?: number; expires_at?: number } = {}
  ): Promise<RefreshWorkspaceTokenResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<RefreshWorkspaceTokenResponse>(
      "POST",
      `/v1/workspaces/${uuid}/tokens`,
      options
    );
  }

  /**
   * Revoke workspace token (requires Clerk JWT auth)
   */
  async revokeWorkspaceToken(
    workspaceId: string,
    jti: string
  ): Promise<{ message: string }> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<{ message: string }>(
      "POST",
      `/v1/workspaces/${uuid}/tokens/${jti}/revoke`
    );
  }

  /**
   * Refresh workspace token (requires Clerk JWT auth)
   * This will generate a new token and revoke the existing one
   */
  async refreshWorkspaceToken(
    workspaceId: string,
    options: { expires_in?: number; expires_at?: number } = {}
  ): Promise<RefreshWorkspaceTokenResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<RefreshWorkspaceTokenResponse>(
      "POST",
      `/v1/workspaces/${uuid}/tokens`,
      options
    );
  }

  /**
   * List workspace tokens (requires workspace JWT auth)
   */
  async listWorkspaceTokens(
    workspaceId: string
  ): Promise<ListWorkspaceTokensResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<ListWorkspaceTokensResponse>(
      "GET",
      `/v1/workspaces/${uuid}/tokens`
    );
  }

  /**
   * Activate workspace
   */
  async activateWorkspace(
    workspaceId: string
  ): Promise<ActivateWorkspaceResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<ActivateWorkspaceResponse>(
      "POST",
      `/v1/workspaces/${uuid}/activate`
    );
  }

  // Registry API methods

  /**
   * List available servers from registry
   */
  async listRegistryServers(
    filters: RegistryServerFilters = {}
  ): Promise<ListRegistryServersResponse> {
    const endpoint = "/v1/registry/servers";
    return this.makeRequest<ListRegistryServersResponse>("GET", endpoint);
  }

  /**
   * Get detailed information about a registry server
   */
  async getRegistryServer(
    serverId: string
  ): Promise<GetRegistryServerResponse> {
    return this.makeRequest<GetRegistryServerResponse>(
      "GET",
      `/v1/registry/servers/${serverId}`
    );
  }

  // Workspace Server API methods

  /**
   * Deploy a server to a workspace
   */
  async deployServer(
    workspaceId: string,
    request: DeployServerRequest
  ): Promise<DeployServerResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<DeployServerResponse>(
      "POST",
      `/v1/workspaces/${uuid}/servers`,
      request
    );
  }

  /**
   * List servers in workspace
   */
  async listWorkspaceServers(
    workspaceId: string
  ): Promise<ListWorkspaceServersResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<ListWorkspaceServersResponse>(
      "GET",
      `/v1/workspaces/${uuid}/servers`
    );
  }

  /**
   * Get detailed server information
   */
  async getWorkspaceServer(
    workspaceId: string,
    serverId: string
  ): Promise<GetWorkspaceServerResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<GetWorkspaceServerResponse>(
      "GET",
      `/v1/workspaces/${uuid}/servers/${serverId}`
    );
  }

  /**
   * Scale a server in a workspace
   */
  async scaleServer(
    workspaceId: string,
    serverId: string,
    request: ScaleServerRequest
  ): Promise<ScaleServerResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<ScaleServerResponse>(
      "POST",
      `/v1/workspaces/${uuid}/servers/${serverId}/scale`,
      request
    );
  }

  /**
   * Remove a server from a workspace
   */
  async removeServer(
    workspaceId: string,
    serverId: string
  ): Promise<RemoveServerResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<RemoveServerResponse>(
      "DELETE",
      `/v1/workspaces/${uuid}/servers/${serverId}`
    );
  }

  /**
   * Get logs for a server in a workspace
   */
  async getServerLogs(
    workspaceId: string,
    serverId: string,
    request: ServerLogsRequest = {}
  ): Promise<ServerLogsResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    const queryParams = new URLSearchParams();

    if (request.lines !== undefined) {
      queryParams.append("lines", request.lines.toString());
    }

    if (request.follow !== undefined) {
      queryParams.append("follow", request.follow.toString());
    }

    if (request.since !== undefined) {
      queryParams.append("since", request.since);
    }

    if (request.timestamps !== undefined) {
      queryParams.append("timestamps", request.timestamps.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `/v1/workspaces/${uuid}/servers/${serverId}/logs?${queryString}`
      : `/v1/workspaces/${uuid}/servers/${serverId}/logs`;

    return this.makeRequest<ServerLogsResponse>("GET", endpoint);
  }

  // Workspace Secrets API methods

  /**
   * List secrets in a workspace
   */
  async listWorkspaceSecrets(
    workspaceId: string
  ): Promise<ListSecretsResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<ListSecretsResponse>(
      "GET",
      `/v1/workspaces/${uuid}/secrets`
    );
  }

  /**
   * Set or update a secret in a workspace
   */
  async setWorkspaceSecret(
    workspaceId: string,
    secretKey: string,
    request: SetSecretRequest
  ): Promise<SetSecretResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<SetSecretResponse>(
      "PUT",
      `/v1/workspaces/${uuid}/secrets/${secretKey}`,
      request
    );
  }

  /**
   * Delete a secret from a workspace
   */
  async deleteWorkspaceSecret(
    workspaceId: string,
    secretKey: string
  ): Promise<DeleteSecretResponse> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<DeleteSecretResponse>(
      "DELETE",
      `/v1/workspaces/${uuid}/secrets/${secretKey}`
    );
  }
}

/**
 * Management API specific error class
 */
export class ManagementApiError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: any
  ) {
    super(message);
    this.name = "ManagementApiError";
    this.statusCode = statusCode;
    if (errorCode !== undefined) this.errorCode = errorCode;
    if (details !== undefined) this.details = details;
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(): boolean {
    return (
      this.statusCode === 401 ||
      this.errorCode === "TOKEN_EXPIRED" ||
      this.errorCode === "AUTHENTICATION_REQUIRED"
    );
  }

  /**
   * Check if error is a not found error
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404 || this.errorCode === "WORKSPACE_NOT_FOUND";
  }

  /**
   * Check if error is a validation error
   */
  isValidationError(): boolean {
    return this.statusCode === 400 || this.errorCode === "INVALID_REQUEST";
  }

  /**
   * Check if error is a conflict error
   */
  isConflictError(): boolean {
    return this.statusCode === 409;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.errorCode) {
      case "AUTHENTICATION_REQUIRED":
        return "Please login first using `ntcli auth login`";
      case "INSUFFICIENT_PERMISSIONS":
        return "You do not have permission to access this resource";
      case "WORKSPACE_NOT_FOUND":
        return "Workspace not found or not accessible";
      case "WORKSPACE_EXISTS":
        return "A workspace with this name already exists";
      case "TOKEN_EXPIRED":
        return "Authentication token has expired - please refresh your workspace token using `ntcli token refresh`";
      case "TOKEN_EXCHANGE_FAILED":
        return "Failed to exchange authentication token - please login again";
      case "INVALID_REQUEST":
        return this.details?.field
          ? `Invalid ${this.details.field}: ${this.message}`
          : this.message;
      case "NETWORK_ERROR":
        return "Unable to connect to the API. Please check your internet connection.";
      case "INVALID_RESPONSE_FORMAT":
        return "Server returned an unexpected response format";
      default:
        if (this.statusCode === 401) {
          return "Authentication failed - please refresh your workspace token using `ntcli token refresh`";
        } else if (this.statusCode === 404) {
          return this.message.includes("404 Not Found")
            ? "API endpoint not found - this may be a server configuration issue"
            : this.message;
        } else if (this.statusCode >= 500) {
          return "Server error - please try again later";
        }
        return this.message;
    }
  }

  /**
   * Check if error indicates token needs refresh/re-authentication
   */
  isTokenError(): boolean {
    return (
      this.errorCode === "TOKEN_EXPIRED" ||
      this.errorCode === "TOKEN_EXCHANGE_FAILED" ||
      this.errorCode === "AUTHENTICATION_REQUIRED"
    );
  }
}
