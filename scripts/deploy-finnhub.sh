#!/bin/bash
set -e

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ .env file not found"
  exit 1
fi

# Check if FINNHUB_API_KEY is set
if [ -z "$FINNHUB_API_KEY" ]; then
  echo "❌ FINNHUB_API_KEY not found in .env file"
  exit 1
fi

echo "🚀 Deploying finnhub server..."

# Set the API key secret
ntcli secrets set FINNHUB_API_KEY="$FINNHUB_API_KEY"

# Deploy the server
ntcli server deploy finnhub

echo "✅ Finnhub deployment complete!"
echo "💡 Use: ntcli mcp tools finnhub"