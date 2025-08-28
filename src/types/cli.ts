/**
 * CLI command options and utility types
 */

export interface WorkspaceCommandOptions {
  verbose?: boolean;
}

export interface RegistryCommandOptions {
  limit?: number;
  verbose?: boolean;
}

export interface SecretsCommandOptions {
  workspace?: string;
  verbose?: boolean;
}

export interface ServerCommandOptions {
  verbose?: boolean;
  workspace?: string;
  force?: boolean;
  wait?: boolean;
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
 * Registry-related legacy types
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

export interface RegistryServerFilters {
  // Filters removed from API - keeping interface for backward compatibility
}