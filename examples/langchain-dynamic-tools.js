#!/usr/bin/env node

/**
 * Simple LangChain example with dynamic tool usage from ntcli MCP servers
 * Demonstrates the pattern: response.tool_calls for automatic tool execution
 * 
 * Prerequisites:
 * 1. npm install @langchain/core @langchain/openai
 * 2. ntcli server deploy nationalparks-mcp
 * 3. Set: OPENAI_API_KEY, NTCLI_WORKSPACE_TOKEN
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';

// Configuration
// Replace YOUR_WORKSPACE_ID with your workspace ID from: ntcli workspace list
const WORKSPACE_ID = 'YOUR_WORKSPACE_ID'; // Get from: ntcli workspace list
const MCP_ENDPOINT = `https://mcp.nimbletools.ai/v1/workspaces/${WORKSPACE_ID}/servers/nationalparks-mcp/mcp`;
const WORKSPACE_TOKEN = process.env.NTCLI_WORKSPACE_TOKEN;

/**
 * Call MCP tool via HTTP
 */
async function callMCPTool(toolName, args) {
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WORKSPACE_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`MCP Error: ${result.error.message}`);
  }
  
  // Extract text content from MCP response
  const content = result.result?.content?.[0]?.text || JSON.stringify(result.result);
  return content;
}

/**
 * Get available tools from MCP server
 */
async function getMCPTools() {
  // Initialize MCP connection
  await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WORKSPACE_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'langchain-client', version: '1.0.0' }
      }
    })
  });

  // Get tools list
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WORKSPACE_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    })
  });

  const result = await response.json();
  return result.result?.tools || [];
}

/**
 * Create LangChain tools dynamically from MCP server
 */
async function createDynamicTools() {
  const mcpTools = await getMCPTools();
  
  return mcpTools.map(tool => new DynamicTool({
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name}`,
    func: async (input) => {
      // Parse input - could be a string or object
      let args = {};
      if (typeof input === 'string') {
        // For simple string inputs, map to common parameter names
        if (tool.name.includes('search')) {
          args = { query: input };
        } else if (tool.name.includes('get') || tool.name.includes('park')) {
          args = { park_code: input };
        } else {
          args = { input: input };
        }
      } else {
        args = input;
      }
      
      return await callMCPTool(tool.name, args);
    }
  }));
}

/**
 * Main function demonstrating dynamic tool usage
 */
async function main() {
  try {
    console.log('🌲 LangChain Dynamic Tools Example');
    console.log('==================================\n');

    // Create tools dynamically from MCP server
    console.log('📡 Discovering MCP tools...');
    const tools = await createDynamicTools();
    
    console.log(`Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Create LLM with tools bound
    const llm = new ChatOpenAI({ 
      modelName: 'gpt-4',
      temperature: 0 
    });
    const llmWithTools = llm.bindTools(tools);

    // Start conversation
    const messages = [
      new HumanMessage("Can you search for information about Yellowstone National Park and then get detailed information about it?")
    ];

    console.log('🤖 Starting conversation with LLM...');
    console.log(`User: ${messages[0].content}\n`);

    // Get initial response
    const response = await llmWithTools.invoke(messages);
    messages.push(response);

    console.log(`Assistant: ${response.content || '(calling tools...)'}\n`);

    // Check for tool calls - this is the key pattern!
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`🔧 Executing ${response.tool_calls.length} tool calls:\n`);

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        console.log(`  Calling ${toolCall.name} with:`, toolCall.args);

        // Find the tool and execute it
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
          try {
            const result = await tool.func(toolCall.args);
            console.log(`  Result: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}\n`);

            // Add tool result to conversation
            messages.push(new ToolMessage({
              content: result,
              tool_call_id: toolCall.id
            }));
          } catch (error) {
            console.log(`  Error: ${error.message}\n`);
            messages.push(new ToolMessage({
              content: `Error: ${error.message}`,
              tool_call_id: toolCall.id
            }));
          }
        }
      }

      // Get final response after tool execution
      console.log('🎯 Getting final response...');
      const finalResponse = await llmWithTools.invoke(messages);
      
      console.log(`\nFinal Answer: ${finalResponse.content}`);

      // Check if there are more tool calls (recursive pattern)
      if (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
        console.log('\n⚠️  More tool calls requested - implement recursion for full automation');
      }

    } else {
      console.log('ℹ️  No tool calls were made by the LLM');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('1. Deployed MCP server: ntcli server deploy nationalparks-mcp');
    console.log('2. Set environment variables: OPENAI_API_KEY, NTCLI_WORKSPACE_TOKEN');
    console.log('3. Update WORKSPACE_ID in this file with your workspace ID from: ntcli workspace list');
    console.log('4. Installed dependencies: npm install @langchain/core @langchain/openai');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createDynamicTools, callMCPTool };