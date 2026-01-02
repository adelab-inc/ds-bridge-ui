# Storybook Standalone - Makefile
# Design Token CLI and Build Commands

.PHONY: help build dev install clean tokens-analyze tokens-generate cli-build

# Paths
DTC_PATH := ./design-tokens-cli.bin
TOKENS_OUTPUT_DIR := packages/ui/src/tokens

# Default target
help:
	@echo "Storybook Standalone - Available Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          - Install dependencies"
	@echo "  make cli-build        - Build Design Token CLI"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start Storybook dev server"
	@echo "  make build            - Build all packages"
	@echo "  make build-storybook  - Build Storybook only"
	@echo "  make build-validator  - Build storybook-validator"
	@echo ""
	@echo "Design Tokens:"
	@echo "  make tokens-analyze FILE=path/to/token.json"
	@echo "  make tokens-generate FILES='file1.json file2.json'"
	@echo ""
	@echo "Utility:"
	@echo "  make clean            - Clean build artifacts"

# Setup
install:
	pnpm install

cli-build:
	go build -C scripts/design-tokens-cli -o ../../design-tokens-cli.bin .
	@echo "Design Token CLI built: ./design-tokens-cli.bin"

# Development
dev:
	pnpm dev:storybook

build:
	pnpm build

build-storybook:
	pnpm build:storybook

build-validator:
	pnpm --filter storybook-validator build

# Design Tokens
tokens-analyze:
ifndef FILE
	@echo "Usage: make tokens-analyze FILE=path/to/token.json"
else
	$(DTC_PATH) design-tokens analyze "$(FILE)"
endif

tokens-generate:
ifndef FILES
	@echo "Usage: make tokens-generate FILES='file1.json file2.json'"
else
	$(DTC_PATH) design-tokens generate --output-dir $(TOKENS_OUTPUT_DIR) $(FILES)
endif

# Utility
clean:
	pnpm clean
	rm -f design-tokens-cli.bin
