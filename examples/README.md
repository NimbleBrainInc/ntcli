# ntcli Examples

This directory contains examples showing how to integrate deployed MCP servers with various AI frameworks.

## LangChain Example

**File:** `langchain-example.js`

Shows how to use deployed MCP servers as LangChain tools for building AI applications.

### Setup

```bash
# Install dependencies
npm install

# Set environment variables
export NTCLI_WORKSPACE_TOKEN="your-workspace-token"  # From: ntcli token show  
export OPENAI_API_KEY="your-openai-key"

# Deploy MCP server
ntcli server deploy nationalparks-mcp

# Run example
npm run langchain
```

### What it does

1. **Creates LangChain tools** from deployed MCP servers
2. **Calls MCP tools** via HTTP API 
3. **Uses OpenAI** to process and summarize results
4. **Demonstrates** the complete integration flow

### Key Features

- ✅ **Direct HTTP calls** to deployed MCP servers
- ✅ **LangChain DynamicTool** integration
- ✅ **Error handling** and setup validation
- ✅ **Modular design** - export tools for reuse

### Example Output

```
🌲 LangChain + ntcli MCP Server Example
=====================================

🔍 Searching for Yellowstone...
Search Result: Found 1 park matching "Yellowstone"...

📍 Getting detailed info for Yellowstone (YELL)...
Park Info: Yellowstone National Park established in 1872...

🤖 Using LangChain to summarize the information...
LangChain Summary: Yellowstone National Park is America's first national park...
```

## Adding More Examples

To add examples for other frameworks:

1. Create a new file: `framework-example.js`
2. Add script to `package.json`: `"framework": "node framework-example.js"`
3. Update this README with setup instructions
4. Follow the same pattern: deploy MCP server → create tools → use framework

## Environment Variables

| Variable | Description | Source |
|----------|-------------|---------|
| `NTCLI_WORKSPACE_TOKEN` | Your workspace access token | `ntcli token show` |
| `OPENAI_API_KEY` | OpenAI API key | OpenAI dashboard |