#!/bin/bash
#
# .mcpb 패키지 생성 스크립트
# MCP Extension Bundle을 생성합니다.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 패키지 정보 읽기
NAME=$(node -p "require('./manifest.json').name")
VERSION=$(node -p "require('./manifest.json').version")
OUTPUT_FILE="${NAME}-${VERSION}.mcpb"

echo "📦 Creating MCP Extension Bundle..."
echo "   Name: $NAME"
echo "   Version: $VERSION"

# 1. 프로덕션 빌드
echo "🔨 Building for production..."
pnpm run build

# 2. 빌드 결과물 확인
if [ ! -f "dist/bundle.js" ]; then
  echo "❌ Error: dist/bundle.js not found"
  exit 1
fi

# 3. 임시 디렉토리 생성
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 4. 필요한 파일 복사 (server/ 디렉토리 구조로)
echo "📋 Copying files..."
cp manifest.json "$TEMP_DIR/"
mkdir -p "$TEMP_DIR/server"
cp dist/bundle.js "$TEMP_DIR/server/index.js"

# 5. data/ 디렉토리 (JSON 파일 번들링)
echo "📦 Bundling JSON data files..."
mkdir -p "$TEMP_DIR/data"

# JSON 파일 경로 (apps/tools/storybook-validator → packages/ui)
UI_PACKAGE_BASE="../../../packages/ui"
COMPONENT_DEFS="$UI_PACKAGE_BASE/src/design-tokens/component-definitions.json"
DESIGN_TOKENS="$UI_PACKAGE_BASE/src/tokens/design-tokens.json"

# 파일 존재 확인 및 복사
if [ -f "$COMPONENT_DEFS" ]; then
  cp "$COMPONENT_DEFS" "$TEMP_DIR/data/"
  echo "   ✓ component-definitions.json"
else
  echo "   ⚠️ Warning: component-definitions.json not found"
  echo "   경로: $COMPONENT_DEFS"
fi

if [ -f "$DESIGN_TOKENS" ]; then
  cp "$DESIGN_TOKENS" "$TEMP_DIR/data/"
  echo "   ✓ design-tokens.json"
else
  echo "   ⚠️ Warning: design-tokens.json not found"
  echo "   경로: $DESIGN_TOKENS"
fi

# 6. .mcpb 패키지 생성 (ZIP 형식)
echo "🗜️  Creating package..."
rm -f "$OUTPUT_FILE"
(cd "$TEMP_DIR" && zip -r "$SCRIPT_DIR/$OUTPUT_FILE" .)

# 6. 결과 확인
echo ""
echo "✅ Package created: $OUTPUT_FILE"
echo ""
echo "📊 Package contents:"
unzip -l "$OUTPUT_FILE"
echo ""
echo "📦 Package size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "🚀 Next steps:"
echo "   1. Open Claude Desktop"
echo "   2. Go to Settings → Extensions"
echo "   3. Click 'Install Extension'"
echo "   4. Select '$OUTPUT_FILE'"
echo ""
