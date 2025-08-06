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
    }

    return response;
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
      method: 'tools/list',
      params: {}
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
      if (process.env.NTCLI_DEBUG) {
        console.error(`   ${JSON.stringify(request, null, 2)}`);
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication if available
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
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

      const responseText = await response.text();
      
      if (process.env.NTCLI_DEBUG) {
        console.error(`   Response: ${responseText}`);
      }

      let responseData: T;
      try {
        responseData = JSON.parse(responseText) as T;
      } catch (parseError) {
        throw new MCPError(`Invalid JSON response: ${responseText}`, -32700);
      }

      if (!response.ok) {
        if (responseData.error) {
          throw new MCPError(
            responseData.error.message,
            responseData.error.code,
            responseData.error.data
          );
        } else {
          throw new MCPError(`HTTP ${response.status}: ${response.statusText}`, response.status);
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