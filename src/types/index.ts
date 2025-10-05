/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Main type exports for the NimbleTools CLI
 * Combines OpenAPI generated types with custom CLI types
 */

// Import OpenAPI generated types
import type { components } from "./api.js";

// Re-export authentication types
export * from "./auth.js";

// Re-export MCP protocol types
export * from "./mcp.js";

// Re-export MCP server types
export * from "./mcp-server.js";

// Re-export CLI command types
export * from "./cli.js";

/**
 * Core API Types (Generated from OpenAPI)
 * Use these for new code - they match the API exactly
 */

// Direct exports of OpenAPI schemas - use these for new code
export type ApiWorkspaceListResponse =
  components["schemas"]["WorkspaceListResponse"];
export type ApiWorkspaceCreateRequest =
  components["schemas"]["WorkspaceCreateRequest"];
export type ApiWorkspaceCreateResponse =
  components["schemas"]["WorkspaceCreateResponse"];
export type ApiWorkspaceDeleteResponse =
  components["schemas"]["WorkspaceDeleteResponse"];
export type ApiWorkspaceDetailsResponse =
  components["schemas"]["WorkspaceDetailsResponse"];
export type ApiServerListResponse = components["schemas"]["ServerListResponse"];
export type ApiServerDeployResponse =
  components["schemas"]["ServerDeployResponse"];
export type ApiServerDetailsResponse =
  components["schemas"]["ServerDetailsResponse"];
export type ApiServerDeleteResponse =
  components["schemas"]["ServerDeleteResponse"];
export type ApiServerScaleRequest = components["schemas"]["ServerScaleRequest"];
export type ApiServerScaleResponse =
  components["schemas"]["ServerScaleResponse"];
export type ApiWorkspaceSecretsResponse =
  components["schemas"]["WorkspaceSecretsResponse"];
export type ApiWorkspaceSecretResponse =
  components["schemas"]["WorkspaceSecretResponse"];
export type ApiHealthCheck = components["schemas"]["HealthCheck"];
export type ApiHTTPValidationError =
  components["schemas"]["HTTPValidationError"];
export type ApiValidationError = components["schemas"]["ValidationError"];

/**
 * Legacy Types (Backward Compatibility)
 * Keep existing interfaces for backward compatibility with current CLI code
 */

// API Error type (custom - not in OpenAPI spec)
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      field?: string;
      reason?: string;
      error_id?: string;
    };
  };
}

// Workspace API request/response types
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface CreateWorkspaceResponse {
  workspace_name: string;
  workspace_id: string;
  namespace: string;
  created: string;
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string[];
  jti?: string;
}

export interface RefreshWorkspaceTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string[];
  message?: string;
  jti?: string;
}

export interface WorkspaceToken {
  jti: string;
  created_at: number;
}

export interface ListWorkspaceTokensResponse {
  workspace_id: string;
  tokens: WorkspaceToken[];
  count: number;
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceInfo[];
  user_id: string;
  total: number;
}

export interface WorkspaceInfo {
  workspace_id: string;
  workspace_name: string;
  created: string;
}

export interface WorkspaceDetails {
  workspace_id: string;
  workspace_name: string;
  namespace: string;
  description?: string;
  created: string;
  owner_user_id: string;
  status: string;
  resources: {
    services: number;
    deployments: number;
  };
}

export interface UpdateWorkspaceRequest {
  description?: string;
}

export interface UpdateWorkspaceResponse {
  workspace: WorkspaceDetails;
  message: string;
}

export interface ActivateWorkspaceResponse {
  workspace_id: string;
  message: string;
}

/**
 * Registry-related types
 */

export interface RegistryServer {
  id: string;
  server_id?: string; // Keep for backward compatibility
  name: string;
  description: string;
  category?: string | null;
  ownership?: "community" | "partner";
  ownership_type?: "community" | "partner"; // Keep for backward compatibility
  featured?: boolean;
  version: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    tools: boolean | any[]; // Can be boolean (list) or array (show)
    resources: boolean | any[];
    prompts: boolean | any[];
  };
  tools_count?: number;
  resources_count?: number;
  prompts_count?: number;
  deployment?: {
    environment_variables?: Record<string, string>;
    resource_limits?: {
      memory: string;
      cpu: string;
    };
  };
  source?: {
    type?: "github" | "docker" | string; // Optional since not always provided by API
    repository?: string;
    branch?: string; // Add branch field from actual API response
    path?: string; // Add path field from actual API response
    docker_image?: string; // Keep for backwards compatibility
    tag?: string; // Keep for backwards compatibility
  };
  image?: string;
  registry?: string;
  namespace?: string;
  tools?: string[];
  replicas?: { [key: string]: number };
  tags?: string[];
}

export interface ListRegistryServersResponse {
  servers: RegistryServer[];
  user_id?: string;
  total: number;
  registry_url?: string;
  categories?: string[];
  ownership_types?: ("community" | "partner")[];
  registries?: any[];
  owner?: string;
}

export interface GetRegistryServerResponse extends RegistryServer {
  // The API returns the server object directly, not wrapped
}

export interface RegistryServerFilters {
  // Filters removed from API - keeping interface for backward compatibility
}

/**
 * Workspace server management types
 */
export interface WorkspaceServer {
  // Core properties from OpenAPI ServerSummary
  id: string;
  name: string;
  workspace_id: string;
  namespace: string;
  image: string;
  status: string;
  replicas: number;
  created?: string | null;

  // Additional properties for backward compatibility
  server_id?: string; // Keep for backward compatibility (maps to id)
  description?: string;
  version?: string;
  port?: number;
  ready_replicas?: number;
  max_replicas?: number;
  cpu_request?: string;
  memory_request?: string;
  cpu_limit?: string;
  memory_limit?: string;
  environment_variables?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  last_deployed?: string;
  service_url?: string;
  health_status?: "healthy" | "unhealthy" | "unknown";
}

export interface DeployServerRequest {
  server_id: string;
  version?: string;
  environment_variables?: Record<string, string>;
  resource_limits?: {
    cpu?: string;
    memory?: string;
  };
  scaling?: {
    min_replicas?: number;
    max_replicas?: number;
  };
  replicas?: number;
}

export interface DeployServerResponse {
  message: string;
  server_id: string;
  name?: string;
  status: "running" | "stopped" | "pending" | "error";
  workspace_id: string;
  namespace?: string;
  mcp_endpoint?: string;
  health_endpoint?: string;
  deployment_id?: string;
  // Optional additional properties that might be in a full response
  description?: string;
  version?: string;
  environment_variables?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  last_deployed?: string;
  service_url?: string;
  health_status?: "healthy" | "unhealthy" | "unknown";
}

// Type alias that uses the OpenAPI ServerListResponse
export type ListWorkspaceServersResponse = ApiServerListResponse;

// Server details response that combines OpenAPI structure with backward compatibility
export interface GetWorkspaceServerResponse {
  // OpenAPI ServerDetailsResponse structure
  id: string;
  name: string;
  workspace_id: string;
  namespace: string;
  image: string;
  spec: { [key: string]: unknown };
  status: { [key: string]: unknown } | string;
  created?: string | null;

  // Backward compatibility properties for existing commands
  server_id?: string; // Fallback to id
  replicas?: number; // May be in spec or status
  ready_replicas?: number; // May be in status
}

export interface ScaleServerRequest {
  replicas?: number;
  max_replicas?: number;
  resource_limits?: {
    cpu?: string;
    memory?: string;
  };
}

export interface ScaleServerResponse {
  server_id: string;
  workspace_id: string;
  replicas: number;
  status: string;
  message: string;
  scaling_operation_id?: string;
  server?: WorkspaceServer;
}

export interface RestartServerRequest {
  force?: boolean;
}

export interface RestartServerResponse {
  server_id: string;
  workspace_id: string;
  status: string;
  message: string;
  restart_operation_id?: string;
  server?: WorkspaceServer;
}

export interface RemoveServerResponse {
  server_id: string;
  workspace_id?: string;
  namespace?: string;
  status?: string;
  message: string;
}

export interface ServerLogsRequest {
  limit?: number;
  since?: string;
  until?: string;
  level?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  pod_name?: string;
}

export interface ServerLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  pod_name?: string;
  container_name?: string;
}

export interface ServerLogsResponse {
  version: string;
  server_id: string;
  workspace_id: string;
  logs: ServerLogEntry[];
  count: number;
  has_more: boolean;
  query_timestamp: string;
}

// Workspace Secrets API types

export interface ListSecretsResponse {
  workspace_id: string;
  secrets: string[];
  count: number;
  message?: string;
}

export interface SetSecretRequest {
  secret_value: string;
}

export interface SetSecretResponse {
  workspace_id: string;
  secret_key: string;
  status: "set";
  message?: string;
}

export interface DeleteSecretResponse {
  workspace_id: string;
  secret_key: string;
  status: "deleted";
  message?: string;
}
