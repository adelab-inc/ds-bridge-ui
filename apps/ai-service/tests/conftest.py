"""Shared HTTP fixture for API tests; business calls are patched by each test."""

import os

import pytest

os.environ.setdefault("SUPABASE_URL", "http://127.0.0.1:9")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dependency-test-fixture")


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    # Without a lifespan context, the production database cleanup is not started.
    return TestClient(app)
