import { config } from "dotenv";
import { ClerkOAuthConfig } from "../types/index.js";

// Load environment variables silently
config({ quiet: true });

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
   * Get Clerk OAuth configuration from environment variables
   */
  getClerkConfig(): ClerkOAuthConfig {
    const clientId = process.env.CLERK_OAUTH_CLIENT_ID || "0MUyvaWYSj4g0lzE";
    const domain = process.env.CLERK_DOMAIN || "clerk.nimbletools.ai";

    console.log("*******");
    console.log("Client ID:", clientId);
    console.log("Domain:", domain);
    console.log("*******");

    if (!clientId || !domain) {
      throw new Error(
        "Missing required environment variables. Please set:\n" +
          "- CLERK_OAUTH_CLIENT_ID (or use embedded default)\n" +
          "- CLERK_DOMAIN (or use embedded default)"
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
    return "~/.nimbletools";
  }

  /**
   * Get the API base URL for development/production
   */
  getApiBaseUrl(): string {
    return process.env.NTCLI_API_URL || "https://mcp.nimbletools.dev";
  }

  /**
   * Get the API base path (for different API versions)
   */
  getApiBasePath(): string {
    return process.env.NTCLI_API_BASE_PATH || "/v1";
  }
}
