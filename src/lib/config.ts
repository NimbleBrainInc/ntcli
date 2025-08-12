import { config } from "dotenv";
import { ClerkOAuthConfig } from "../types/index.js";

// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV;
const envFiles = [
  ...(nodeEnv ? [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`] : []),
  `.env.local`, 
  `.env`
];

// Load env files in order of priority (first found wins for each variable)
envFiles.forEach(file => {
  config({ path: file, quiet: true });
});

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
   * Get the Management API base URL
   */
  getManagementApiUrl(): string {
    return process.env.NTCLI_MANAGEMENT_API_URL || "https://api.nimbletools.ai";
  }

  /**
   * Get the MCP API base URL
   */
  getMcpApiUrl(): string {
    return process.env.NTCLI_MCP_API_URL || "https://mcp.nimbletools.ai";
  }

  /**
   * Get the API base URL for development/production (legacy)
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

  /**
   * Get current NODE_ENV
   */
  getNodeEnv(): string | undefined {
    return process.env.NODE_ENV;
  }
}
