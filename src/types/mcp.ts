/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * MCP Protocol types
 */

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export interface MCPInitializeRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "initialize";
  params: {
    protocolVersion: string;
    capabilities: {
      tools?: {};
      resources?: {};
      prompts?: {};
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPInitializeResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: {
    protocolVersion: string;
    capabilities: {
      tools?: {
        listChanged?: boolean;
      };
      resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
      };
      prompts?: {
        listChanged?: boolean;
      };
      logging?: {};
    };
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolsListResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: {
    tools: MCPTool[];
  };
}

export interface MCPToolCallRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "tools/call";
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface MCPToolCallResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: {
    content: Array<{
      type: "text";
      text: string;
    }>;
    isError?: boolean;
  };
}

export interface MCPCommandOptions {
  workspace?: string;
  verbose?: boolean;
  timeout?: number;
}