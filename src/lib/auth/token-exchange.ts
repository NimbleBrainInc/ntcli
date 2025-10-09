import { ConfigManager } from '../config-manager.js';

/**
 * Token exchange response from the API
 */
export interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
}

/**
 * Exchange Clerk OAuth token for NimbleBrain API token
 */
export class TokenExchangeClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // Use ConfigManager to get the Studio API URL
      const configManager = new ConfigManager();
      this.baseUrl = configManager.getStudioApiUrl();
    }
  }

  /**
   * Exchange Clerk ID token for NimbleBrain bearer token
   */
  async exchangeToken(idToken: string): Promise<string> {
    const url = `${this.baseUrl}/api/v1/auth/token-exchange`;

    if (process.env.NTCLI_DEBUG) {
      console.log('\n[DEBUG] Token Exchange Request:');
      console.log('  URL:', url);
      console.log('  ID Token (first 50 chars):', idToken.substring(0, 50) + '...');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oauth_token: idToken
        }),
      });

      if (process.env.NTCLI_DEBUG) {
        console.log('[DEBUG] Response Status:', response.status);
      }

      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorBody = await response.json() as any;
          errorMessage = errorBody.detail || errorBody.message || errorBody.error || '';
        } catch {
          errorMessage = await response.text();
        }

        if (process.env.NTCLI_DEBUG) {
          console.log('[DEBUG] Error Response:', errorMessage);
        }

        // Include status code in error message for better handling
        if (response.status === 403) {
          throw new Error(`403: ${errorMessage || 'Access forbidden'}`);
        } else if (response.status === 401) {
          throw new Error(`401: ${errorMessage || 'Unauthorized'}`);
        } else if (response.status >= 500) {
          throw new Error(`${response.status}: ${errorMessage || 'Server error'}`);
        } else {
          throw new Error(`${response.status}: ${errorMessage || 'Request failed'}`);
        }
      }

      const data = await response.json() as TokenExchangeResponse;

      if (!data.access_token) {
        throw new Error('Token exchange response missing access_token');
      }

      return data.access_token;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to exchange token: ${error.message}`);
      }
      throw new Error('Failed to exchange token: Unknown error');
    }
  }
}