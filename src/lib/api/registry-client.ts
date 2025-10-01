import { ConfigManager } from '../config-manager.js';

/**
 * Client for interacting with the NimbleTools Registry service (registry.nimbletools.ai)
 * Handles fetching MCP server definitions from the registry
 */
export class RegistryClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = 'https://registry.nimbletools.ai') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'ntcli/1.0.0',
    };
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Add query parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: this.defaultHeaders,
      };

      if (process.env.NTCLI_DEBUG) {
        console.error(`[DEBUG] ${method} ${url.toString()}`);
        console.error(`[DEBUG] Headers:`, this.defaultHeaders);
      }

      const response = await fetch(url.toString(), fetchOptions);
      const responseText = await response.text();

      if (process.env.NTCLI_DEBUG) {
        console.error(`[DEBUG] Response Status:`, response.status);
        console.error(`[DEBUG] Response Body:`, responseText.substring(0, 500));
      }

      // Handle empty responses
      if (!responseText) {
        if (response.ok) {
          return {} as T;
        } else {
          throw new RegistryApiError(
            'Empty response from registry',
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
          throw new RegistryApiError(
            `Invalid JSON response: ${responseText}`,
            response.status
          );
        }
      }

      if (!response.ok) {
        const errorMessage = responseData?.error?.message ||
                           responseData?.message ||
                           responseText ||
                           `HTTP ${response.status}`;

        throw new RegistryApiError(errorMessage, response.status);
      }

      return responseData;
    } catch (error) {
      if (error instanceof RegistryApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new RegistryApiError(
          'Network error - unable to connect to the registry',
          0
        );
      }

      throw new RegistryApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        0
      );
    }
  }

  /**
   * List available servers from the registry
   */
  async listServers(options: {
    cursor?: string;
    limit?: number;
  } = {}): Promise<RegistryListServersResponse> {
    const params: Record<string, string> = {};

    if (options.cursor) {
      params.cursor = options.cursor;
    }

    if (options.limit) {
      params.limit = options.limit.toString();
    }

    return this.makeRequest<RegistryListServersResponse>('GET', '/v0/servers', params);
  }

  /**
   * Get detailed information about a specific server
   */
  async getServer(
    serverId: string,
    version?: string
  ): Promise<MCPServerDefinition> {
    const params: Record<string, string> = {};

    if (version) {
      params.version = version;
    }

    return this.makeRequest<MCPServerDefinition>('GET', `/v0/servers/${encodeURIComponent(serverId)}`, params);
  }

  /**
   * Get available versions for a server
   */
  async getServerVersions(serverId: string): Promise<ServerVersionsResponse> {
    return this.makeRequest<ServerVersionsResponse>('GET', `/v0/servers/${encodeURIComponent(serverId)}/versions`);
  }
}

/**
 * Registry API error class
 */
export class RegistryApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'RegistryApiError';
    this.statusCode = statusCode;
  }

  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

// Type definitions for Registry API responses

export interface RegistryListServersResponse {
  servers: MCPServerDefinition[];
  cursor?: string;
  hasMore?: boolean;
}

export interface ServerVersionsResponse {
  versions: string[];
  latest?: string;
}

/**
 * MCP Server Definition following the NimbleBrain extended schema
 * Based on https://registry.nimbletools.ai/schemas/2025-09-22/nimblebrain-server.schema.json
 */
export interface MCPServerDefinition {
  // Standard MCP fields
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string | { url?: string; source?: string; branch?: string };

  // Server transport configuration
  transport?: {
    type: 'stdio' | 'http' | 'websocket';
    runtime?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };

  // Capabilities
  capabilities?: {
    tools?: Array<{
      name: string;
      description?: string;
    }>;
    resources?: Array<{
      name: string;
      description?: string;
    }>;
    prompts?: Array<{
      name: string;
      description?: string;
    }>;
  };

  // NimbleBrain extended metadata
  _meta?: {
    'ai.nimblebrain.mcp/v1'?: NimbleToolsRuntime;
  };
}

/**
 * NimbleTools-specific runtime configuration
 */
export interface NimbleToolsRuntime {
  container?: {
    healthCheck?: {
      path?: string;
      port?: number;
      interval?: number;
      timeout?: number;
      retries?: number;
    };
    startupProbe?: {
      initialDelaySeconds?: number;
      periodSeconds?: number;
      failureThreshold?: number;
    };
  };

  resources?: {
    limits?: {
      memory?: string;
      cpu?: string;
    };
    requests?: {
      memory?: string;
      cpu?: string;
    };
  };

  scaling?: {
    enabled?: boolean;
    minReplicas?: number;
    maxReplicas?: number;
    targetCPUUtilizationPercentage?: number;
  };

  observability?: {
    metrics?: {
      enabled?: boolean;
      path?: string;
      port?: number;
    };
    tracing?: {
      enabled?: boolean;
      endpoint?: string;
    };
  };

  security?: {
    runAsNonRoot?: boolean;
    runAsUser?: number;
    readOnlyRootFilesystem?: boolean;
    allowPrivilegeEscalation?: boolean;
  };

  networking?: {
    ingress?: {
      enabled?: boolean;
      hosts?: string[];
      tls?: boolean;
      annotations?: Record<string, string>;
    };
    service?: {
      type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
      annotations?: Record<string, string>;
    };
  };

  registry?: {
    categories?: string[];
    tags?: string[];
    branding?: {
      logoUrl?: string;
      iconUrl?: string;
      primaryColor?: string;
      accentColor?: string;
    };
    documentation?: {
      readmeUrl?: string;
      changelogUrl?: string;
      licenseUrl?: string;
      examplesUrl?: string;
    };
    showcase?: {
      featured?: boolean;
      screenshots?: Array<{
        url: string;
        caption?: string;
        thumbnail?: string;
      }>;
      videoUrl?: string;
    };
  };
}