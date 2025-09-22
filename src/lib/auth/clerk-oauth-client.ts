import { createHash, randomBytes } from "crypto";
import { URLSearchParams } from "url";
import {
  ClerkOAuthConfig,
  ClerkTokenResponse,
  OAuthTokens,
  PKCEChallenge,
  UserInfo,
} from "../../types/index.js";

// Hardcoded Clerk domain for all OAuth operations
const CLERK_OAUTH_DOMAIN = "clerk.nimbletools.ai";

/**
 * Clerk OAuth client implementing OAuth 2.0 with PKCE flow
 */
export class ClerkOAuthClient {
  private config: ClerkOAuthConfig;

  constructor(config: ClerkOAuthConfig) {
    this.config = config;
  }

  /**
   * Generate PKCE challenge for secure OAuth flow
   */
  generatePKCEChallenge(): PKCEChallenge {
    const codeVerifier = this.base64URLEncode(randomBytes(32));
    const codeChallenge = this.base64URLEncode(
      createHash("sha256").update(codeVerifier).digest()
    );

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: "S256",
    };
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  generateState(): string {
    return this.base64URLEncode(randomBytes(32));
  }

  /**
   * Build the authorization URL for Clerk OAuth
   */
  buildAuthorizationUrl(pkceChallenge: PKCEChallenge, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(" "),
      state,
      code_challenge: pkceChallenge.codeChallenge,
      code_challenge_method: pkceChallenge.codeChallengeMethod,
    });

    return `https://${CLERK_OAUTH_DOMAIN}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<OAuthTokens> {
    const tokenUrl = `https://${CLERK_OAUTH_DOMAIN}/oauth/token`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = (await response.json()) as ClerkTokenResponse;

    return {
      accessToken: tokenData.access_token,
      ...(tokenData.refresh_token && { refreshToken: tokenData.refresh_token }),
      ...(tokenData.id_token && { idToken: tokenData.id_token }),
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      tokenType: tokenData.token_type,
    };
  }

  /**
   * Fetch user information using the access token
   */
  async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    const userUrl = `https://${CLERK_OAUTH_DOMAIN}/oauth/userinfo`;

    const response = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch user info: ${response.status} ${errorText}`
      );
    }

    const userData = (await response.json()) as any;

    // Handle standard OAuth userinfo response format
    if (userData.sub && userData.email) {
      return {
        id: userData.sub,
        email: userData.email,
        ...(userData.given_name && { firstName: userData.given_name }),
        ...(userData.family_name && { lastName: userData.family_name }),
        ...(userData.preferred_username && {
          username: userData.preferred_username,
        }),
      };
    }

    // Fallback to Clerk-specific format if available
    if (userData.id && userData.email_addresses) {
      const primaryEmail =
        userData.email_addresses.find(
          (email: any) => email.verification?.status === "verified"
        ) || userData.email_addresses[0];

      if (!primaryEmail) {
        throw new Error("No email address found for user");
      }

      return {
        id: userData.id,
        email: primaryEmail.email_address,
        ...(userData.first_name && { firstName: userData.first_name }),
        ...(userData.last_name && { lastName: userData.last_name }),
        ...(userData.username && { username: userData.username }),
      };
    }

    throw new Error("Invalid user data format received from OAuth provider");
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const tokenUrl = `https://${CLERK_OAUTH_DOMAIN}/oauth/token`;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenData = (await response.json()) as ClerkTokenResponse;

    return {
      accessToken: tokenData.access_token,
      ...(tokenData.refresh_token && { refreshToken: tokenData.refresh_token }),
      ...(!tokenData.refresh_token && refreshToken && { refreshToken }),
      ...(tokenData.id_token && { idToken: tokenData.id_token }),
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      tokenType: tokenData.token_type,
    };
  }

  /**
   * Base64 URL encode without padding
   */
  private base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
}
