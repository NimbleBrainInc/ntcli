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
  RefreshWorkspaceTokenResponse,
  RegistryServerFilters,
  RemoveServerResponse,
  ScaleServerRequest,
  ScaleServerResponse,
  ServerLogsRequest,
  ServerLogsResponse,
  SetSecretRequest,
  SetSecretResponse,
  UpdateWorkspaceRequest,
  UpdateWorkspaceResponse,
  WorkspaceDetails,
} from "../../types/index.js";

/**
 * HTTP client for NimbleBrain Platform API
 */
export class NimbleBrainApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

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
    baseUrl: string = process.env.NTCLI_API_URL || "https://mcp.nimbletools.dev"
  ) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "ntcli/1.0.0",
    };
  }

  /**
   * Get the base URL for the API client
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set Clerk JWT token for workspace creation
   */
  setClerkJwtToken(token: string): void {
    this.defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  /**
   * Set workspace access token for workspace operations
   */
  setWorkspaceToken(token: string): void {
    this.defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  /**
   * Clear authentication headers
   */
  clearAuth(): void {
    delete this.defaultHeaders["Authorization"];
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
    const headers = { ...this.defaultHeaders, ...customHeaders };

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      // Handle self-signed certificates in development
      if (
        process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
        process.env.NTCLI_IGNORE_SSL
      ) {
        // For Node.js 18+ with fetch API, we need to use a custom agent
        const { Agent } = await import("https");
        (fetchOptions as any).agent = new Agent({
          rejectUnauthorized: false,
        });
      }

      // Debug output if verbose
      if (process.env.NTCLI_DEBUG) {
        console.error(`🌐 ${method} ${url}`);
        if (process.env.NTCLI_DEBUG) {
          console.error(`   Headers:`, JSON.stringify(headers, null, 2));
          if (body) console.error(`   Body:`, JSON.stringify(body, null, 2));
        }
      }

      const response = await fetch(url, fetchOptions);

      if (process.env.NTCLI_DEBUG) {
        const statusEmoji = response.ok ? "✅" : "❌";
        console.error(
          `   ${statusEmoji} ${response.status} ${response.statusText}`
        );
      }

      const responseText = await response.text();
      let responseData: any;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};

        if (process.env.NTCLI_DEBUG) {
          console.log(
            "[DEBUG] Response Body\n",
            JSON.stringify(responseData, null, 2)
          );
        }
      } catch (parseError) {
        if (process.env.NTCLI_DEBUG) {
          console.error(`   JSON parse error:`, parseError);
        }
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        // Handle API error responses
        if (responseData.error) {
          const apiError = responseData as ApiErrorResponse;
          throw new ApiError(
            apiError.error.message,
            response.status,
            apiError.error.code,
            apiError.error.details
          );
        } else {
          throw new ApiError(
            responseData.message ||
              `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors with more detailed debugging
      if (process.env.NTCLI_DEBUG) {
        console.log(`[DEBUG] Caught error:`, error);
        console.log(
          `[DEBUG] Error type:`,
          error && typeof error === "object"
            ? error.constructor.name
            : typeof error
        );
        console.log(
          `[DEBUG] Error message:`,
          error instanceof Error ? error.message : String(error)
        );
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ApiError(
          "Network error: Unable to connect to the API. Please check your internet connection.",
          0,
          "NETWORK_ERROR"
        );
      }

      throw new ApiError(
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
      `${this.getBasePath()}/workspaces`,
      request
    );
  }

  /**
   * List user workspaces
   */
  async listWorkspaces(): Promise<ListWorkspacesResponse> {
    return this.makeRequest<ListWorkspacesResponse>(
      "GET",
      `${this.getBasePath()}/workspaces`
    );
  }

  /**
   * Get the API base path from config
   */
  private getBasePath(): string {
    return process.env.NTCLI_API_BASE_PATH || "/v1";
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId: string): Promise<WorkspaceDetails> {
    return this.makeRequest<WorkspaceDetails>(
      "GET",
      `/v1/workspaces/${workspaceId}`
    );
  }

  /**
   * Update workspace
   */
  async updateWorkspace(
    workspaceId: string,
    request: UpdateWorkspaceRequest
  ): Promise<UpdateWorkspaceResponse> {
    return this.makeRequest<UpdateWorkspaceResponse>(
      "PUT",
      `/v1/workspaces/${workspaceId}`,
      request
    );
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(
      "DELETE",
      `/v1/workspaces/${workspaceId}`
    );
  }

  /**
   * Refresh workspace token (requires NimbleTools JWT auth)
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
   * Activate workspace
   */
  async activateWorkspace(
    workspaceId: string
  ): Promise<ActivateWorkspaceResponse> {
    return this.makeRequest<ActivateWorkspaceResponse>(
      "POST",
      `/v1/workspaces/${workspaceId}/activate`
    );
  }

  // Registry API methods

  /**
   * List registry servers with optional filters
   */
  async listRegistryServers(
    filters: RegistryServerFilters = {}
  ): Promise<ListRegistryServersResponse> {
    const endpoint = `${this.getBasePath()}/registry/servers`;
    return this.makeRequest<ListRegistryServersResponse>("GET", endpoint);
  }

  /**
   * Get detailed information about a specific registry server
   */
  async getRegistryServer(
    serverId: string
  ): Promise<GetRegistryServerResponse> {
    return this.makeRequest<GetRegistryServerResponse>(
      "GET",
      `${this.getBasePath()}/registry/servers/${serverId}`
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
      `${this.getBasePath()}/workspaces/${uuid}/servers`,
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
      `${this.getBasePath()}/workspaces/${uuid}/servers`
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
      `${this.getBasePath()}/workspaces/${uuid}/servers/${serverId}`
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
      `${this.getBasePath()}/workspaces/${uuid}/servers/${serverId}/scale`,
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
      `${this.getBasePath()}/workspaces/${uuid}/servers/${serverId}`
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
    if (request.since) {
      queryParams.append("since", request.since);
    }
    if (request.timestamps !== undefined) {
      queryParams.append("timestamps", request.timestamps.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString
      ? `${this.getBasePath()}/workspaces/${uuid}/servers/${serverId}/logs?${queryString}`
      : `${this.getBasePath()}/workspaces/${uuid}/servers/${serverId}/logs`;

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
      `${this.getBasePath()}/workspaces/${uuid}/secrets`
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
      `${this.getBasePath()}/workspaces/${uuid}/secrets/${secretKey}`,
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
      `${this.getBasePath()}/workspaces/${uuid}/secrets/${secretKey}`
    );
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string | undefined;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string | undefined,
    details?: any
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if error is a specific type
   */
  isErrorCode(code: string): boolean {
    return this.errorCode === code;
  }

  /**
   * Check if error is authentication related
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  /**
   * Check if error is a validation error
   */
  isValidationError(): boolean {
    return this.statusCode === 400;
  }

  /**
   * Check if error is a not found error
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
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
        return "Authentication token has expired - please login again";
      case "TOKEN_EXCHANGE_FAILED":
        return "Failed to exchange authentication token - please login again";
      case "INVALID_REQUEST":
        return this.details?.field
          ? `Invalid ${this.details.field}: ${this.message}`
          : this.message;
      case "NETWORK_ERROR":
        return "Unable to connect to the API. Please check your internet connection.";
      default:
        if (this.statusCode === 401) {
          return "Authentication failed - please login again using `ntcli auth login`";
        }
        return this.message;
    }
  }

  /**
   * Check if error indicates token needs refresh/re-authentication
   */
  isTokenError(): boolean {
    return (
      this.statusCode === 401 ||
      this.errorCode === "TOKEN_EXPIRED" ||
      this.errorCode === "TOKEN_EXCHANGE_FAILED" ||
      this.errorCode === "AUTHENTICATION_REQUIRED"
    );
  }
}
