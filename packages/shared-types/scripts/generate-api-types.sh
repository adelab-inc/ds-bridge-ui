#!/bin/bash
##
# Generate TypeScript types from OpenAPI spec
# Usage: bash generate-api-types.sh
##

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
API_DIR="$PROJECT_ROOT/api"
OUTPUT_DIR="$PROJECT_ROOT/typescript/api"

# OpenAPI spec URL
OPENAPI_URL="https://ai-server-233376868812.asia-northeast3.run.app/openapi.json"

echo "🔄 Generating API types from OpenAPI spec..."
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Download OpenAPI spec from remote server
echo "📥 Downloading OpenAPI spec from $OPENAPI_URL..."
curl -s "$OPENAPI_URL" -o "$API_DIR/openapi.raw.json"
echo "✅ Downloaded: api/openapi.raw.json"

# Fix broken $ref in multipart/form-data schema (FastAPI bug)
echo "🔧 Fixing OpenAPI schema..."
jq '
  # Remove broken $ref from multipart/form-data schemas while keeping inline properties
  walk(
    if type == "object" and .["$ref"] and .type == "object" and .properties
    then del(.["$ref"])
    else .
    end
  )
' "$API_DIR/openapi.raw.json" > "$API_DIR/openapi.json"
rm "$API_DIR/openapi.raw.json"
echo "✅ Fixed: api/openapi.json"
echo ""

# Run openapi-typescript
npx openapi-typescript "$API_DIR/openapi.json" -o "$OUTPUT_DIR/schema.ts"

echo ""
echo "✅ Generated: typescript/api/schema.ts"
echo ""
echo "✨ API type generation complete!"
