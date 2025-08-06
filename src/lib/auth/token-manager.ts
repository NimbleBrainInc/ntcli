import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { OAuthTokens, UserInfo } from '../../types/index.js';

/**
 * Minimal token manager that only handles Clerk authentication
 * (Workspace tokens are now handled by WorkspaceStorage)
 */
export class TokenManager {
  private configDir: string;
  private tokensFile: string;
  private userInfoFile: string;

  constructor() {
    this.configDir = join(homedir(), '.nimbletools');
    this.tokensFile = join(this.configDir, 'tokens.json');
    this.userInfoFile = join(this.configDir, 'user.json');
    this.ensureConfigDir();
  }

  private ensureConfigDir(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Check if user is authenticated with Clerk
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = this.loadClerkTokens();
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
      const tokens = this.loadClerkTokens();
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
      const tokens = this.loadClerkTokens();
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
    const tokensData = JSON.stringify(tokens, null, 2);
    writeFileSync(this.tokensFile, tokensData, { mode: 0o600 });
  }

  /**
   * Store user info
   */
  async storeUserInfo(userInfo: UserInfo): Promise<void> {
    const userInfoData = JSON.stringify(userInfo, null, 2);
    writeFileSync(this.userInfoFile, userInfoData, { mode: 0o600 });
  }

  /**
   * Clear all stored authentication data
   */
  async clearAll(): Promise<void> {
    try {
      if (existsSync(this.tokensFile)) {
        require('fs').unlinkSync(this.tokensFile);
      }
      if (existsSync(this.userInfoFile)) {
        require('fs').unlinkSync(this.userInfoFile);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<UserInfo | null> {
    try {
      if (!existsSync(this.userInfoFile)) {
        return null;
      }
      const userInfoData = readFileSync(this.userInfoFile, 'utf8');
      return JSON.parse(userInfoData) as UserInfo;
    } catch {
      return null;
    }
  }

  private loadClerkTokens(): OAuthTokens | null {
    try {
      if (!existsSync(this.tokensFile)) {
        return null;
      }
      const tokensData = readFileSync(this.tokensFile, 'utf8');
      return JSON.parse(tokensData) as OAuthTokens;
    } catch {
      return null;
    }
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
    await this.storeClerkTokens(tokens);
    await this.storeUserInfo(userInfo);
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
    const tokens = this.loadClerkTokens();
    const userInfo = await this.getUserInfo();
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