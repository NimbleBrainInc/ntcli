#!/bin/bash

# Simple JWT decoder script
# Usage: ./decode-jwt.sh <jwt-token>
#   or:  ./decode-jwt.sh (reads from ~/.nimbletools/tokens.json)

if [ $# -eq 0 ]; then
    # No argument provided, try to read from tokens file
    TOKENS_FILE="$HOME/.nimbletools/tokens.json"
    if [ ! -f "$TOKENS_FILE" ]; then
        echo "Error: No JWT token provided and $TOKENS_FILE not found"
        echo "Usage: $0 <jwt-token>"
        exit 1
    fi
    
    # Extract idToken from JSON file (handles multiline JSON)
    JWT=$(cat "$TOKENS_FILE" | jq -r '.idToken // empty' 2>/dev/null)
    if [ -z "$JWT" ]; then
        # Fallback: try grep approach for non-jq systems
        JWT=$(cat "$TOKENS_FILE" | tr -d '\n' | grep -o '"idToken":"[^"]*"' | cut -d'"' -f4)
    fi
    if [ -z "$JWT" ]; then
        echo "Error: Could not find idToken in $TOKENS_FILE"
        exit 1
    fi
    echo "🔍 Decoding idToken from $TOKENS_FILE"
else
    JWT="$1"
fi

# Check if JWT has 3 parts
if [ $(echo "$JWT" | tr -cd '.' | wc -c) -ne 2 ]; then
    echo "Error: Invalid JWT format (should have 3 parts separated by dots)"
    exit 1
fi

# Function to add base64 padding and decode
decode_part() {
    local part="$1"
    local name="$2"
    
    # Add padding to make length multiple of 4
    while [ $((${#part} % 4)) -ne 0 ]; do
        part="${part}="
    done
    
    echo "=== $name ==="
    echo "$part" | base64 -d 2>/dev/null | jq . 2>/dev/null || {
        echo "Raw (not JSON):"
        echo "$part" | base64 -d 2>/dev/null || echo "Failed to decode"
    }
    echo
}

# Split JWT into parts
HEADER=$(echo "$JWT" | cut -d. -f1)
PAYLOAD=$(echo "$JWT" | cut -d. -f2)
SIGNATURE=$(echo "$JWT" | cut -d. -f3)

# Decode each part
decode_part "$HEADER" "HEADER"
decode_part "$PAYLOAD" "PAYLOAD"

echo "=== SIGNATURE ==="
echo "Base64: $SIGNATURE"
echo "(Signature verification requires the secret key)"
echo

# Show audience specifically
echo "🎯 AUDIENCE (aud):"
echo "$PAYLOAD" | while [ $((${#PAYLOAD} % 4)) -ne 0 ]; do PAYLOAD="${PAYLOAD}="; done && echo "$PAYLOAD" | base64 -d 2>/dev/null | jq -r '.aud // "Not found"' 2>/dev/null || echo "Could not extract audience"