/**
 * Authentication-related types for the CLI
 */

export interface ClerkOAuthConfig {
  clientId: string;
  domain: string;
  redirectUri: string;
  scopes: string[];
}

// OAuth tokens received from Clerk (only used during login flow)
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  tokenType: string;
}

// NimbleBrain API authentication
export interface NimbleBrainAuth {
  bearerToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    organizationId?: string | undefined;
  };
}

export interface UserInfo {
  id: string;
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  organizationId?: string | undefined;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface OAuthAuthorizationResponse {
  code: string;
  state: string;
  [key: string]: any; // Allow additional parameters from OAuth callback
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
  force?: boolean;
}

/**
 * Authentication provider interface for API clients
 * Centralizes authentication logic and token management
 */
export interface AuthProvider {
  /**
   * Get authentication headers for requests
   * Returns empty object if no authentication should be added
   */
  getAuthHeaders(): Record<string, string>;

  /**
   * Set authentication token
   * Implementation decides whether to store it or ignore it
   */
  setToken(_token: string): void;

  /**
   * Clear authentication
   */
  clearAuth(): void;

  /**
   * Check if authentication is enabled
   */
  isAuthEnabled(): boolean;
}

/**
 * Auth provider factory options
 */
export interface AuthProviderOptions {
  isAuthDisabled?: boolean;
  tokenSource?: 'clerk' | 'workspace';
}

/**
 * Token source interface for auth providers
 */
export interface TokenSource {
  getToken(): Promise<string | null>;
}