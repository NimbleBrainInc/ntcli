import { TokenManager } from './token-manager.js';

/**
 * Helper for Clerk authentication operations
 */
export class ClerkAuthHelper {
  private tokenManager: TokenManager;

  constructor() {
    this.tokenManager = new TokenManager();
  }

  /**
   * Check if user is authenticated with Clerk
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      return await this.tokenManager.isAuthenticated();
    } catch {
      return false;
    }
  }

  /**
   * Get valid Clerk JWT token
   */
  async getValidClerkJwtToken(): Promise<string | null> {
    try {
      return await this.tokenManager.getValidClerkJwtToken();
    } catch {
      return null;
    }
  }
}