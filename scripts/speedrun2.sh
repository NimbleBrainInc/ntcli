#!/bin/bash
set -e  # Exit on any error

echo "🏃 Starting speedrun test..."

echo "1. Testing health endpoint..."
ntcli health
echo "✅ Health check passed"

echo -e "\n2. Listing registry servers..."
ntcli reg list
echo "✅ Registry listing passed"

echo -e "\n3. Creating workspace..."
WORKSPACE_NAME="speedrun-$(date +%s)"
ntcli ws create "$WORKSPACE_NAME"
echo "✅ Workspace created: $WORKSPACE_NAME"

echo -e "\n3b. Selecting workspace..."
ntcli ws switch "$WORKSPACE_NAME"
echo "✅ Workspace selected: $WORKSPACE_NAME"

echo -e "\n4. Deploying reverse-text server..."
ntcli server deploy reverse-text
echo "✅ reverse-text server deployed"

echo -e "\n⏳ Waiting 20 seconds for server to be ready..."
sleep 20

echo -e "\n5. Testing MCP call..."
RESULT=$(ntcli mcp call reverse-text reverse_text text=mississippi)
echo "MCP call result: $RESULT"
if echo "$RESULT" | grep -q "SPEEDRUN_TEST"; then
    echo "✅ MCP call successful - payload verified"
else
    echo "❌ MCP call failed - payload not found in response"
    exit 1
fi

echo -e "\n6. Cleaning up workspace..."
ntcli ws delete "$WORKSPACE_NAME"
echo "✅ Workspace cleaned up"

echo -e "\n🎉 Speedrun completed successfully!"
