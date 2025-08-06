#!/usr/bin/env node

/**
 * Simple LangChain example using ntcli deployed MCP servers
 * 
 * Prerequisites:
 * 1. Install dependencies: npm install @langchain/core @langchain/openai
 * 2. Deploy MCP server: ntcli server deploy nationalparks-mcp
 * 3. Set environment variables: OPENAI_API_KEY, NTCLI_WORKSPACE_TOKEN
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';

// MCP Server configuration from ntcli
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
  return result.result?.content?.[0]?.text || 'No result';
}

/**
 * Create LangChain tool from MCP server
 */
const searchParks = new DynamicTool({
  name: 'search_parks',
  description: 'Search for national parks by name or keyword',
  func: async (query) => {
    return await callMCPTool('search_parks', { query });
  }
});

const getPark = new DynamicTool({
  name: 'get_park',
  description: 'Get detailed information about a specific national park by park code',
  func: async (parkCode) => {
    return await callMCPTool('get_park', { park_code: parkCode });
  }
});

// Initialize LangChain with tools
const llm = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0
});

const tools = [searchParks, getPark];

/**
 * Simple example: Ask about Yellowstone
 */
async function main() {
  try {
    console.log('🌲 LangChain + ntcli MCP Server Example');
    console.log('=====================================\n');

    // First, search for Yellowstone
    console.log('🔍 Searching for Yellowstone...');
    const searchResult = await searchParks.func('Yellowstone');
    console.log('Search Result:', searchResult);
    console.log('');

    // Get detailed info (assuming YELL is the park code)
    console.log('📍 Getting detailed info for Yellowstone (YELL)...');
    const parkInfo = await getPark.func('YELL');
    console.log('Park Info:', parkInfo);
    console.log('');

    // Use LangChain to process the information
    console.log('🤖 Using LangChain to summarize the information...');
    const prompt = `Based on this park information: ${parkInfo}\n\nProvide a brief, engaging summary of Yellowstone National Park for tourists.`;
    
    const response = await llm.invoke([new HumanMessage(prompt)]);
    console.log('LangChain Summary:');
    console.log(response.content);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('1. Deployed the MCP server: ntcli server deploy nationalparks-mcp');
    console.log('2. Set environment variables: OPENAI_API_KEY, NTCLI_WORKSPACE_TOKEN');
    console.log('3. Update WORKSPACE_ID in this file with your workspace ID from: ntcli workspace list');
    console.log('4. Installed dependencies: npm install @langchain/core @langchain/openai');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { searchParks, getPark, callMCPTool };