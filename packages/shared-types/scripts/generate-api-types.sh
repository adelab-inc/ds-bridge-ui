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

echo "🔄 Generating API types from OpenAPI spec..."
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Run openapi-typescript
npx openapi-typescript "$API_DIR/openapi.json" -o "$OUTPUT_DIR/schema.ts"

echo ""
echo "✅ Generated: typescript/api/schema.ts"
echo ""
echo "✨ API type generation complete!"
