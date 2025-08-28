import { AuthProvider } from '../../types/auth.js';

/**
 * Simple authentication provider that always sends Bearer tokens when available
 * Let the server decide whether to accept or reject with 401
 */
export class SimpleAuthProvider implements AuthProvider {
  private currentToken: string | null = null;

  constructor() {}

  getAuthHeaders(): Record<string, string> {
    if (this.currentToken) {
      return {
        'Authorization': `Bearer ${this.currentToken}`
      };
    }
    return {};
  }

  setToken(token: string): void {
    this.currentToken = token;
  }

  clearAuth(): void {
    this.currentToken = null;
  }

  isAuthEnabled(): boolean {
    return true;
  }
}

/**
 * Factory to create auth provider
 */
export class AuthProviderFactory {
  /**
   * Create a simple auth provider that always sends tokens when available
   */
  static createProvider(): AuthProvider {
    return new SimpleAuthProvider();
  }
}