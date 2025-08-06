/**
 * Authentication-related types for the CLI
 */

export interface ClerkOAuthConfig {
  clientId: string;
  domain: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | undefined;
  idToken?: string | undefined;
  expiresAt: number;
  tokenType: string;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  username?: string | undefined;
}

export interface AuthState {
  isAuthenticated: boolean;
  user?: UserInfo;
  tokens?: OAuthTokens;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface OAuthAuthorizationResponse {
  code: string;
  state: string;
}

export interface ClerkTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

export interface ClerkUserResponse {
  id: string;
  email_addresses: Array<{
    email_address: string;
    verification?: {
      status: string;
    };
  }>;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface LocalServerConfig {
  port: number;
  host: string;
  path: string;
}

export interface AuthCommandOptions {
  port?: number;
  timeout?: number;
  verbose?: boolean;
}

/**
 * NimbleBrain Platform API types
 */

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
}

export interface RefreshWorkspaceTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string[];
  message?: string;
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceInfo[];
  user_id: string;
  total: number;
}

export interface WorkspaceInfo {
  workspace_id: string;
  workspace_name: string;
  namespace: string;
  description?: string;
  created: string;
  status: string;
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

// Legacy workspace types for backward compatibility
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
}

export interface CreateWorkspaceOptions {
  name: string;
  description?: string;
}

/**
 * Registry-related types
 */
export interface RegistryItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  repository?: string;
  homepage?: string;
  downloadCount?: number;
  lastUpdated: string;
}

/**
 * New registry API types
 */
export interface RegistryServer {
  id: string;
  server_id?: string; // Keep for backward compatibility
  name: string;
  description: string;
  category: string;
  ownership?: "community" | "partner";
  ownership_type?: "community" | "partner"; // Keep for backward compatibility
  featured?: boolean;
  version: string;
  author: string;
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
  tools_count: number;
  resources_count: number;
  prompts_count: number;
  deployment?: {
    environment_variables?: Record<string, string>;
    resource_limits?: {
      memory: string;
      cpu: string;
    };
  };
  source?: {
    type: "github" | "docker";
    repository?: string;
    docker_image?: string;
    tag?: string;
  };
}

export interface ListRegistryServersResponse {
  servers: RegistryServer[];
  user_id: string;
  total: number;
  registry_url: string;
  categories: string[];
  ownership_types: ("community" | "partner")[];
}

export interface GetRegistryServerResponse extends RegistryServer {
  // The API returns the server object directly, not wrapped
}

export interface RegistryServerFilters {
  // Filters removed from API - keeping interface for backward compatibility
}

/**
 * Command options
 */
export interface WorkspaceCommandOptions {
  verbose?: boolean;
}

export interface RegistryCommandOptions {
  limit?: number;
  verbose?: boolean;
}

/**
 * Workspace server management types
 */
export interface WorkspaceServer {
  server_id: string;
  name: string;
  description?: string;
  version?: string;
  status: "running" | "stopped" | "pending" | "error";
  image: string;
  port: number;
  replicas: number;
  ready_replicas: number;
  max_replicas?: number;
  cpu_request?: string;
  memory_request?: string;
  cpu_limit?: string;
  memory_limit?: string;
  environment_variables?: Record<string, string>;
  created: string;
  created_at?: string;
  updated_at?: string;
  last_deployed?: string;
  namespace: string;
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
}

export interface DeployServerResponse {
  message: string;
  server_id: string;
  name: string;
  status: "running" | "stopped" | "pending" | "error";
  replicas: number;
  workspace_id: string;
  deployment_id?: string;
  // Optional additional properties that might be in a full response
  description?: string;
  version?: string;
  image?: string;
  port?: number;
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

export interface ListWorkspaceServersResponse {
  servers: WorkspaceServer[];
  workspace_id: string;
  total: number;
}

export interface GetWorkspaceServerResponse {
  server_id: string;
  name: string;
  replicas: number;
  ready_replicas: number;
  status: "running" | "stopped" | "pending" | "error" | "scaling";
  created: string;
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
  server: WorkspaceServer;
  scaling_operation_id: string;
  message: string;
}

export interface RemoveServerResponse {
  server_id: string;
  message: string;
}

export interface ServerLogsRequest {
  lines?: number;
  follow?: boolean;
  since?: string;
  timestamps?: boolean;
}

export interface ServerLogsResponse {
  server_id: string;
  logs: string[];
  truncated?: boolean;
}

// Workspace Secrets API types

export interface ListSecretsResponse {
  workspace_id: string;
  secrets: string[];
  count: number;
}

export interface SetSecretRequest {
  value: string;
}

export interface SetSecretResponse {
  workspace_id: string;
  secret_key: string;
  status: "set";
}

export interface DeleteSecretResponse {
  workspace_id: string;
  secret_key: string;
  status: "deleted";
}

export interface SecretsCommandOptions {
  workspace?: string;
  verbose?: boolean;
}

// MCP Protocol types

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export interface MCPInitializeRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "initialize";
  params: {
    protocolVersion: string;
    capabilities: {
      tools?: {};
      resources?: {};
      prompts?: {};
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPInitializeResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: {
    protocolVersion: string;
    capabilities: {
      tools?: {
        listChanged?: boolean;
      };
      resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
      };
      prompts?: {
        listChanged?: boolean;
      };
      logging?: {};
    };
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolsListResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: {
    tools: MCPTool[];
  };
}

export interface MCPToolCallRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "tools/call";
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface MCPToolCallResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: {
    content: Array<{
      type: "text";
      text: string;
    }>;
    isError?: boolean;
  };
}

export interface MCPCommandOptions {
  workspace?: string;
  verbose?: boolean;
  timeout?: number;
}

export interface ServerCommandOptions {
  verbose?: boolean;
  workspace?: string;
  force?: boolean;
  wait?: boolean;
}
