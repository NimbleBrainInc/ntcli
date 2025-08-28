import { AuthProvider } from "../../types/auth.js";
import { AuthProviderFactory } from "../auth/auth-provider.js";
import { ConfigManager } from "../config-manager.js";

/**
 * HTTP client for NimbleTools MCP Runtime API (mcp.nimbletools.dev)
 * Handles MCP protocol operations with simplified paths
 */
export class MCPRuntimeClient {
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
      this.baseUrl = configManager.getMcpApiUrl();
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
   * Get the MCP runtime base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set workspace token for MCP operations
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
   * Get MCP endpoint URL for a workspace and server
   */
  getMcpEndpoint(workspaceId: string, serverId: string): string {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return `${this.baseUrl}/${uuid}/${serverId}/mcp`;
  }

  /**
   * Get health endpoint URL for a workspace and server  
   */
  getHealthEndpoint(workspaceId: string, serverId: string): string {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return `${this.baseUrl}/${uuid}/${serverId}/health`;
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
          throw new MCPRuntimeError("Empty response from server", response.status);
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
          throw new MCPRuntimeError(`Invalid JSON response: ${responseText}`, response.status);
        }
      }

      if (!response.ok) {
        // Try to extract error information from response
        const errorMessage = responseData?.error?.message || responseText || `HTTP ${response.status}`;
        const errorCode = responseData?.error?.code || 'UNKNOWN_ERROR';
        const errorDetails = responseData?.error?.details;

        throw new MCPRuntimeError(errorMessage, response.status, errorCode, errorDetails);
      }

      return responseData;
    } catch (error) {
      if (error instanceof MCPRuntimeError) {
        throw error;
      }

      // Handle network errors, timeout, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new MCPRuntimeError("Network error - unable to connect to MCP runtime", 0, 'NETWORK_ERROR');
      }

      throw new MCPRuntimeError(
        error instanceof Error ? error.message : "Unknown error occurred",
        0,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Check health of an MCP server
   */
  async checkHealth(workspaceId: string, serverId: string): Promise<{ status: string; message?: string }> {
    const uuid = this.extractWorkspaceUuid(workspaceId);
    return this.makeRequest<{ status: string; message?: string }>(
      "GET",
      `/${uuid}/${serverId}/health`
    );
  }
}

/**
 * MCP Runtime API specific error class
 */
export class MCPRuntimeError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: any;

  constructor(message: string, statusCode: number, errorCode?: string, details?: any) {
    super(message);
    this.name = 'MCPRuntimeError';
    this.statusCode = statusCode;
    if (errorCode !== undefined) this.errorCode = errorCode;
    if (details !== undefined) this.details = details;
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if error is a not found error
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.errorCode) {
      case "NETWORK_ERROR":
        return "Unable to connect to MCP runtime. Please check your internet connection.";
      case "SERVER_NOT_FOUND":
        return "MCP server not found or not accessible";
      case "SERVER_UNAVAILABLE":
        return "MCP server is currently unavailable";
      default:
        if (this.statusCode === 401) {
          return "Authentication failed - please refresh your workspace token using `ntcli token refresh`";
        } else if (this.statusCode === 404) {
          return "MCP server endpoint not found";
        } else if (this.statusCode >= 500) {
          return "MCP runtime error - please try again later";
        }
        return this.message;
    }
  }
}