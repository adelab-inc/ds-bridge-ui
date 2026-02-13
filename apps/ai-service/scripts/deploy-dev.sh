#!/bin/bash
set -e

# ============================================================================
# DS Bridge AI Service - Cloud Run Deploy Script (DEV)
# ============================================================================

# Script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${CYAN}[DEV]${NC} ${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${CYAN}[DEV]${NC} ${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${CYAN}[DEV]${NC} ${RED}[ERROR]${NC} $1"
}

# ============================================================================
# Load .env file
# ============================================================================

load_env() {
    local env_file="${SERVICE_DIR}/.env"

    if [ -f "$env_file" ]; then
        log_info "Loading environment from .env file..."

        while IFS='=' read -r key value; do
            [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue

            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)

            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"

            if [ -z "${!key}" ]; then
                export "$key=$value"
            fi
        done < "$env_file"
    else
        log_warn "No .env file found at $env_file"
    fi
}

# ============================================================================
# Configuration (DEV)
# ============================================================================

PROJECT_ID="ds-runtime-hub"
REGION="asia-northeast3"
SERVICE_NAME="ai-server-dev"               # ← dev 서비스명
REPO_NAME="ds-runtime-hub"

IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

# Load API keys from .env
load_env

check_requirements() {
    log_info "Checking requirements..."

    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        echo "  https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi

    if ! gcloud auth print-identity-token &> /dev/null; then
        log_warn "Not logged in to gcloud. Running 'gcloud auth login'..."
        gcloud auth login
    fi

    log_info "All requirements met!"
}

# ============================================================================
# Main Commands
# ============================================================================

build() {
    log_info "Building Docker image (DEV)..."

    cd "$(dirname "$0")/.."

    docker build \
        --platform linux/amd64 \
        -t "${IMAGE_NAME}:latest" \
        -t "${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)" \
        .

    log_info "Build complete: ${IMAGE_NAME}:latest"
}

push() {
    log_info "Pushing image to Artifact Registry (DEV)..."

    gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

    docker push "${IMAGE_NAME}:latest"

    log_info "Push complete!"
}

deploy_simple() {
    log_info "Deploying to Cloud Run (DEV)..."

    if [ -z "${OPENAI_API_KEY}" ] && [ -z "${ANTHROPIC_API_KEY}" ] && [ -z "${GEMINI_API_KEY}" ]; then
        log_error "At least one API key must be set:"
        echo "  export OPENAI_API_KEY=sk-..."
        echo "  export ANTHROPIC_API_KEY=sk-ant-..."
        echo "  export GEMINI_API_KEY=AIza..."
        exit 1
    fi

    # ^@^ 구분자 사용 (URL의 콜론/쉼표 충돌 방지)
    ENV_VARS="^@^PYTHONUNBUFFERED=1"
    [ -n "${AI_PROVIDER}" ] && ENV_VARS="${ENV_VARS}@AI_PROVIDER=${AI_PROVIDER}"
    [ -n "${OPENAI_API_KEY}" ] && ENV_VARS="${ENV_VARS}@OPENAI_API_KEY=${OPENAI_API_KEY}"
    [ -n "${ANTHROPIC_API_KEY}" ] && ENV_VARS="${ENV_VARS}@ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
    [ -n "${GEMINI_API_KEY}" ] && ENV_VARS="${ENV_VARS}@GEMINI_API_KEY=${GEMINI_API_KEY}"
    [ -n "${X_API_KEY}" ] && ENV_VARS="${ENV_VARS}@X_API_KEY=${X_API_KEY}"
    [ -n "${CORS_ORIGINS}" ] && ENV_VARS="${ENV_VARS}@CORS_ORIGINS=${CORS_ORIGINS}"
    [ -n "${FIREBASE_PROJECT_ID}" ] && ENV_VARS="${ENV_VARS}@FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
    [ -n "${FIREBASE_STORAGE_BUCKET}" ] && ENV_VARS="${ENV_VARS}@FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET}"

    gcloud run deploy "${SERVICE_NAME}" \
        --image "${IMAGE_NAME}:latest" \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --allow-unauthenticated \
        --port 8080 \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 2 \
        --timeout 300 \
        --set-env-vars "${ENV_VARS}"

    log_info "Deployment complete!"

    # Get service URL
    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --format "value(status.url)")

    echo ""
    log_info "Service URL: ${SERVICE_URL}"
    log_info "Health check: ${SERVICE_URL}/health"
}

all() {
    check_requirements
    build
    push
    deploy_simple
}

logs() {
    log_info "Fetching logs (DEV)..."
    gcloud run services logs read "${SERVICE_NAME}" \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --limit 100
}

describe() {
    gcloud run services describe "${SERVICE_NAME}" \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}"
}

# ============================================================================
# Usage
# ============================================================================

usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "  *** DEV Environment ***"
    echo ""
    echo "Commands:"
    echo "  build          Build Docker image"
    echo "  push           Push image to Artifact Registry"
    echo "  deploy-simple  Deploy to Cloud Run (with env vars)"
    echo "  all            Build, push, and deploy"
    echo "  logs           View recent logs"
    echo "  describe       Show service details"
    echo ""
    echo "Example:"
    echo "  $0 all"
}

# ============================================================================
# Entry Point
# ============================================================================

case "${1:-}" in
    build)
        build
        ;;
    push)
        push
        ;;
    deploy-simple)
        check_requirements
        deploy_simple
        ;;
    all)
        all
        ;;
    logs)
        logs
        ;;
    describe)
        describe
        ;;
    *)
        usage
        exit 1
        ;;
esac
