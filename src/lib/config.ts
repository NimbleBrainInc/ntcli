import { ClerkOAuthConfig } from "../types/index.js";
import { ConfigManager } from "./config-manager.js";

/**
 * Configuration for the CLI application
 */
export class Config {
  private static instance: Config;

  private constructor() {}

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Get Clerk OAuth configuration
   */
  getClerkConfig(): ClerkOAuthConfig {
    const clientId = process.env.CLERK_OAUTH_CLIENT_ID || "0MUyvaWYSj4g0lzE";

    // Get domain from unified config
    const configManager = new ConfigManager();
    const domain = configManager.getClerkDomain();

    if (!clientId) {
      throw new Error(
        "Missing required environment variable: CLERK_OAUTH_CLIENT_ID"
      );
    }

    return {
      clientId,
      domain,
      redirectUri: `http://localhost:${this.getDefaultPort()}/callback`,
      scopes: ["openid", "email", "profile"],
    };
  }

  /**
   * Get the default port for the local OAuth callback server
   */
  getDefaultPort(): number {
    return parseInt(process.env.NTCLI_DEFAULT_PORT || "41247", 10);
  }

  /**
   * Get the timeout for OAuth operations in milliseconds
   */
  getOAuthTimeout(): number {
    return parseInt(process.env.NTCLI_OAUTH_TIMEOUT || "300000", 10); // 5 minutes
  }

  /**
   * Get the config directory path
   */
  getConfigDir(): string {
    return "~/.ntcli";
  }


  /**
   * Get current NODE_ENV
   */
  getNodeEnv(): string | undefined {
    return process.env.NODE_ENV;
  }

  /**
   * Get default community user ID
   * Used when no auth token is available
   */
  getCommunityUserId(): string {
    return "00000000-0000-0000-0000-000000000001";
  }

  /**
   * Get default community organization ID
   * Used when no auth token is available
   */
  getCommunityOrganizationId(): string {
    return "00000000-0000-0000-0000-000000000002";
  }

}
