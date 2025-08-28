import { OAuthTokens, UserInfo } from '../../types/index.js';
import { ConfigManager } from '../config-manager.js';

/**
 * Token manager that handles Clerk authentication using unified configuration
 */
export class TokenManager {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Check if user is authenticated with Clerk
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = this.configManager.getAuthTokens();
      return tokens !== null && this.isClerkTokenValid(tokens);
    } catch {
      return false;
    }
  }

  /**
   * Get valid Clerk JWT token (access token)
   */
  async getValidClerkJwtToken(): Promise<string | null> {
    try {
      const tokens = this.configManager.getAuthTokens();
      if (!tokens || !this.isClerkTokenValid(tokens)) {
        return null;
      }
      return tokens.accessToken;
    } catch {
      return null;
    }
  }

  /**
   * Get valid Clerk ID token
   */
  async getValidClerkIdToken(): Promise<string | null> {
    try {
      const tokens = this.configManager.getAuthTokens();
      if (!tokens || !this.isClerkTokenValid(tokens) || !tokens.idToken) {
        return null;
      }
      return tokens.idToken;
    } catch {
      return null;
    }
  }

  /**
   * Store Clerk tokens
   */
  async storeClerkTokens(tokens: OAuthTokens): Promise<void> {
    const userInfo = this.configManager.getUserInfo();
    if (userInfo) {
      this.configManager.setAuth(tokens, userInfo);
    }
  }

  /**
   * Store user info
   */
  async storeUserInfo(userInfo: UserInfo): Promise<void> {
    const tokens = this.configManager.getAuthTokens();
    if (tokens) {
      this.configManager.setAuth(tokens, userInfo);
    }
  }

  /**
   * Clear all stored authentication data
   */
  async clearAll(): Promise<void> {
    this.configManager.clearAuth();
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<UserInfo | null> {
    return this.configManager.getUserInfo();
  }

  private isClerkTokenValid(tokens: OAuthTokens): boolean {
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
    return tokens.expiresAt > (now + bufferMs);
  }

  /**
   * Save auth session (tokens + user info)
   */
  async saveAuthSession(tokens: OAuthTokens, userInfo: UserInfo): Promise<void> {
    this.configManager.setAuth(tokens, userInfo);
  }

  /**
   * Clear tokens (alias for clearAll)
   */
  async clearTokens(): Promise<void> {
    await this.clearAll();
  }

  /**
   * Get authentication state
   */
  async getAuthState(): Promise<{
    isAuthenticated: boolean;
    user?: UserInfo;
    tokens?: OAuthTokens;
  }> {
    const tokens = this.configManager.getAuthTokens();
    const userInfo = this.configManager.getUserInfo();
    const isAuthenticated = tokens !== null && this.isClerkTokenValid(tokens);

    const result: {
      isAuthenticated: boolean;
      user?: UserInfo;
      tokens?: OAuthTokens;
    } = {
      isAuthenticated
    };

    if (userInfo) {
      result.user = userInfo;
    }

    if (tokens && isAuthenticated) {
      result.tokens = tokens;
    }

    return result;
  }
}