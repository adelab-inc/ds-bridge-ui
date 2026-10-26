"""Shared HTTP fixture for API tests; business calls are patched by each test."""

import os

import pytest

os.environ.setdefault("SUPABASE_URL", "http://127.0.0.1:9")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dependency-test-fixture")


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.core.auth import verify_api_key
    from app.main import app

    # Bypass the internal X-API-Key check so results don't depend on a local .env X_API_KEY.
    app.dependency_overrides[verify_api_key] = lambda: ""
    # Without a lifespan context, the production database cleanup is not started.
    yield TestClient(app)
    app.dependency_overrides.pop(verify_api_key, None)
