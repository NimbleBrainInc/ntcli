/**
 * MCP Server Schema Types
 * Based on the NimbleBrain MCP Server schema extending the standard MCP protocol
 */

/**
 * Standard MCP Transport configuration
 */
export interface McpTransport {
  type: 'stdio' | 'http' | 'websocket' | string;
  runtime?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Standard MCP Capability definitions
 */
export interface McpCapabilities {
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>;
  resources?: Array<{
    name: string;
    description?: string;
    mimeType?: string;
  }>;
  prompts?: Array<{
    name: string;
    description?: string;
    arguments?: Array<{
      name: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
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
    categories?: Array<
      'ai-ml' | 'data' | 'development' | 'productivity' | 'communication' |
      'finance' | 'media' | 'security' | 'devops' | 'monitoring' |
      'storage' | 'web' | 'blockchain' | 'gaming' | 'education' |
      'health' | 'utilities' | 'integration' | 'analytics' | 'automation'
    >;
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

/**
 * Full MCP Server specification with NimbleTools extensions
 */
export interface McpServer {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;

  // MCP Protocol fields
  transport: McpTransport;
  capabilities?: McpCapabilities;

  // NimbleTools metadata extension
  _meta?: {
    'ai.nimblebrain.mcp/v1'?: NimbleToolsRuntime;
    [key: string]: unknown;
  };

  // Additional fields that might be present
  [key: string]: unknown;
}

/**
 * Registry API response types
 */
export interface RegistryListResponse {
  servers: McpServer[];
  hasMore?: boolean;
  nextCursor?: string;
  total?: number;
}

export interface RegistrySearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  featured?: boolean;
  limit?: number;
  cursor?: string;
}