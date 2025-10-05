import { UserInfo, NimbleBrainAuth } from '../../types/index.js';
import { ConfigManager } from '../config-manager.js';

/**
 * Token manager that handles NimbleBrain authentication
 */
export class TokenManager {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.configManager.isAuthenticated();
  }

  /**
   * Get NimbleBrain API bearer token
   */
  async getNimbleBrainToken(): Promise<string | null> {
    return this.configManager.getBearerToken();
  }

  /**
   * Save authentication session
   */
  async saveAuthSession(auth: NimbleBrainAuth): Promise<void> {
    this.configManager.setAuth(auth);
  }

  /**
   * Clear authentication
   */
  async clearTokens(): Promise<void> {
    this.configManager.clearAuth();
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<UserInfo | null> {
    return this.configManager.getUserInfo();
  }
}