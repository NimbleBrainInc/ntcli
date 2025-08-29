import {
  MCPRequest,
  MCPResponse,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPToolsListResponse,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPTool
} from '../../types/index.js';

/**
 * MCP Client for communicating with MCP servers
 */
export class MCPClient {
  private baseUrl: string;
  private initialized: boolean = false;
  private serverInfo?: { name: string; version: string };
  private serverCapabilities?: any;
  private requestId: number = 1;
  private authToken?: string | undefined;
  private sessionId?: string;

  constructor(mcpEndpoint: string, authToken?: string | undefined) {
    this.baseUrl = mcpEndpoint;
    this.authToken = authToken;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Initialize the MCP connection
   */
  async initialize(): Promise<MCPInitializeResponse> {
    const request: MCPInitializeRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        clientInfo: {
          name: 'ntcli',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest<MCPInitializeResponse>(request);
    
    if (response.result) {
      this.initialized = true;
      this.serverInfo = response.result.serverInfo;
      this.serverCapabilities = response.result.capabilities;
      
      // Extract session ID if present in response
      if ((response.result as any).sessionId) {
        this.sessionId = (response.result as any).sessionId;
      }
      
      // Send notifications/initialized after successful initialization
      await this.sendInitializedNotification();
    }

    return response;
  }

  /**
   * Send notifications/initialized after successful initialization
   */
  private async sendInitializedNotification(): Promise<void> {
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };

    if (process.env.NTCLI_DEBUG) {
      console.error(`🔄 MCP Notification: ${notification.method}`);
      console.error(`   ${JSON.stringify(notification, null, 2)}`);
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      if (this.sessionId) {
        headers['mcp-session-id'] = this.sessionId;
      }

      if (process.env.NTCLI_DEBUG) {
        console.error(`   Request Headers:`);
        for (const [key, value] of Object.entries(headers)) {
          console.error(`     ${key}: ${value}`);
        }
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(notification)
      });

      if (process.env.NTCLI_DEBUG) {
        const statusEmoji = response.ok ? '✅' : '❌';
        console.error(`   ${statusEmoji} ${response.status} ${response.statusText}`);
      }

      // Notifications don't expect a response, so we don't parse the body
    } catch (error) {
      if (process.env.NTCLI_DEBUG) {
        console.error(`   [DEBUG] Notification error:`, error);
      }
      // Don't throw - notifications are fire-and-forget
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPToolsListResponse> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/list'
    };

    return this.sendRequest<MCPToolsListResponse>(request);
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, args: Record<string, any> = {}): Promise<MCPToolCallResponse> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call initialize() first.');
    }

    const request: MCPToolCallRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    return this.sendRequest<MCPToolCallResponse>(request);
  }

  /**
   * Send a raw MCP request
   */
  async sendRawRequest(method: string, params: any = {}): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    return this.sendRequest<MCPResponse>(request);
  }

  /**
   * Send HTTP request to MCP endpoint
   */
  private async sendRequest<T extends MCPResponse>(request: MCPRequest): Promise<T> {
    if (process.env.NTCLI_DEBUG) {
      console.error(`🔄 MCP Request: ${request.method}`);
      console.error(`   ${JSON.stringify(request, null, 2)}`);
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      };

      // Add authentication if available
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      // Add session ID if available
      if (this.sessionId) {
        headers['mcp-session-id'] = this.sessionId;
      }

      if (process.env.NTCLI_DEBUG) {
        console.error(`   Request Headers:`);
        for (const [key, value] of Object.entries(headers)) {
          console.error(`     ${key}: ${value}`);
        }
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });

      if (process.env.NTCLI_DEBUG) {
        const statusEmoji = response.ok ? '✅' : '❌';
        console.error(`   ${statusEmoji} ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const sessionHeader = response.headers.get('mcp-session-id') || response.headers.get('x-session-id') || response.headers.get('session-id');
      const responseText = await response.text();
      
      // Extract session ID from response headers if present
      if (sessionHeader && !this.sessionId) {
        this.sessionId = sessionHeader;
        if (process.env.NTCLI_DEBUG) {
          console.error(`   [DEBUG] Extracted session ID from headers: ${this.sessionId}`);
        }
      }
      
      if (process.env.NTCLI_DEBUG) {
        console.error(`   Content-Type: ${contentType}`);
        console.error(`   All Response Headers:`);
        for (const [key, value] of response.headers.entries()) {
          console.error(`     ${key}: ${value}`);
        }
        console.error(`   Response: ${responseText}`);
      }

      let responseData: T;
      try {
        // Check Content-Type header to determine response format
        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          // Parse SSE format - extract JSON from data: line
          const lines = responseText.split('\n');
          let jsonData: string | null = null;
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              jsonData = line.substring(5).trim(); // Remove 'data:' prefix
              break;
            }
          }
          
          if (!jsonData) {
            throw new Error('No data line found in SSE response');
          }
          
          responseData = JSON.parse(jsonData) as T;
          
          // Debug: log parsed SSE data to see if session ID is present
          if (process.env.NTCLI_DEBUG && !this.sessionId) {
            console.error(`[DEBUG] Parsed SSE JSON:`, JSON.stringify(responseData, null, 2));
          }
        } else {
          // Standard JSON response
          responseData = JSON.parse(responseText) as T;
        }
      } catch (parseError) {
        if (process.env.NTCLI_DEBUG) {
          console.error(`[DEBUG] JSON parse error:`, parseError);
          console.error(`[DEBUG] Raw response:`, responseText);
        }
        throw new MCPError(`Invalid JSON response: ${responseText}`, -32700);
      }

      if (!response.ok) {
        // For HTTP errors, check if we have a valid MCP error response
        if (responseData && responseData.error) {
          throw new MCPError(
            responseData.error.message,
            responseData.error.code,
            responseData.error.data
          );
        } else {
          // Handle non-MCP HTTP errors (like 502 from nginx)
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          if (response.status === 502) {
            errorMessage = 'MCP server is not accessible (502 Bad Gateway) - server may be down or misconfigured';
          } else if (response.status === 503) {
            errorMessage = 'MCP server is temporarily unavailable (503 Service Unavailable)';
          } else if (response.status === 504) {
            errorMessage = 'MCP server request timed out (504 Gateway Timeout)';
          }
          throw new MCPError(errorMessage, response.status);
        }
      }

      if (responseData.error) {
        throw new MCPError(
          responseData.error.message,
          responseData.error.code,
          responseData.error.data
        );
      }

      return responseData;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new MCPError(
          'Network error: Unable to connect to MCP server. Please check the server is running.',
          -32603
        );
      }

      throw new MCPError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        -32603
      );
    }
  }

  /**
   * Get server info (only available after initialization)
   */
  getServerInfo(): { name: string; version: string } | undefined {
    return this.serverInfo;
  }

  /**
   * Get server capabilities (only available after initialization)
   */
  getServerCapabilities(): any {
    return this.serverCapabilities;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Custom MCP Error class
 */
export class MCPError extends Error {
  public readonly code: number;
  public readonly data?: any;

  constructor(message: string, code: number, data?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Check if error is a specific JSON-RPC error code
   */
  isErrorCode(code: number): boolean {
    return this.code === code;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case -32700:
        return 'Invalid JSON in MCP request or response';
      case -32600:
        return 'Invalid MCP request format';
      case -32601:
        return 'MCP method not found';
      case -32602:
        return 'Invalid MCP method parameters';
      case -32603:
        return 'Internal MCP server error';
      case -32000:
        return 'MCP server error';
      default:
        return this.message;
    }
  }
}