"""
backend/tests/test_auth_middleware.py

Unit tests for auth middleware (dependencies.py).

Tests:
- get_tenant_id() with no header → returns None
- get_tenant_id() with valid JWT, no user_tenant mapping → returns None
- get_tenant_id() with valid JWT + mapping → returns tenant_id
- get_tenant_id() with invalid JWT → raises 401
- get_current_tenant() with no header → raises 401
- get_current_tenant() with valid JWT + mapping → returns tenant_id
- get_current_tenant() with expired JWT → raises 401
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.dependencies import _decode_jwt, _extract_bearer_token, get_current_tenant, get_tenant_id


# ── _extract_bearer_token ─────────────────────────────────────────────────────


class TestExtractBearerToken:
    """Test Bearer token extraction from Authorization header."""

    def test_no_header(self):
        request = MagicMock()
        request.headers = {}
        assert _extract_bearer_token(request) is None

    def test_empty_header(self):
        request = MagicMock()
        request.headers = {"Authorization": ""}
        assert _extract_bearer_token(request) is None

    def test_bearer_token(self):
        request = MagicMock()
        request.headers = {"Authorization": "Bearer some-token-value"}
        assert _extract_bearer_token(request) == "some-token-value"

    def test_non_bearer_scheme(self):
        request = MagicMock()
        request.headers = {"Authorization": "Basic abc123"}
        assert _extract_bearer_token(request) is None

    def test_bearer_with_extra_spaces(self):
        request = MagicMock()
        request.headers = {"Authorization": "Bearer  token-with-spaces  "}
        # The function strips exactly "Bearer " (7 chars), so the token includes extra spaces
        result = _extract_bearer_token(request)
        assert result.startswith(" ")


# ── _decode_jwt ───────────────────────────────────────────────────────────────


class TestDecodeJWT:
    """Test JWT decoding and verification."""

    @patch("app.api.dependencies.settings")
    def test_decode_valid_jwt(self, mock_settings, valid_jwt_token):
        mock_settings.SUPABASE_JWT_SECRET = "test-secret-key-for-jwt-signing"
        payload = _decode_jwt(valid_jwt_token)
        assert payload["sub"] == "test-user-001"

    @patch("app.api.dependencies.settings")
    def test_decode_expired_jwt(self, mock_settings, expired_jwt_token):
        mock_settings.SUPABASE_JWT_SECRET = "test-secret-key-for-jwt-signing"
        with pytest.raises(HTTPException) as exc:
            _decode_jwt(expired_jwt_token)
        assert exc.value.status_code == 401

    @patch("app.api.dependencies.settings")
    def test_decode_invalid_jwt(self, mock_settings):
        mock_settings.SUPABASE_JWT_SECRET = "test-secret-key-for-jwt-signing"
        with pytest.raises(HTTPException) as exc:
            _decode_jwt("not-a-valid-token")
        assert exc.value.status_code == 401

    @patch("app.api.dependencies.settings")
    def test_decode_jwt_no_secret(self, mock_settings):
        mock_settings.SUPABASE_JWT_SECRET = None
        with pytest.raises(HTTPException) as exc:
            _decode_jwt("some-token")
        assert exc.value.status_code == 500
        assert "SUPABASE_JWT_SECRET" in exc.value.detail


# ── get_tenant_id ─────────────────────────────────────────────────────────────


class TestGetTenantId:
    """Test get_tenant_id dependency function."""

    def test_no_authorization_header_returns_none(self):
        """No Authorization header → returns None (FJ staff access)."""
        request = MagicMock()
        request.headers = {}
        mock_session = MagicMock()

        result = get_tenant_id(request, mock_session)
        assert result is None

    def test_valid_jwt_no_mapping_returns_none(self):
        """Valid JWT but no user_tenant mapping → returns None."""

        request = MagicMock()
        request.headers = {"Authorization": "Bearer dummy-token"}
        mock_session = MagicMock()

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "unknown-user-id"}
            mock_session.exec.return_value.first.return_value = None

            result = get_tenant_id(request, mock_session)
            assert result is None

            # Verify query was made with the user ID
            mock_session.exec.assert_called_once()

    def test_valid_jwt_with_mapping_returns_tenant_id(self):
        """Valid JWT + user_tenant mapping → returns tenant_id."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer dummy-token"}
        mock_session = MagicMock()

        mock_user_tenant = MagicMock()
        mock_user_tenant.tenant_id = "tenant-123"

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "test-user-001"}
            mock_session.exec.return_value.first.return_value = mock_user_tenant

            result = get_tenant_id(request, mock_session)
            assert result == "tenant-123"

    def test_invalid_jwt_raises_401(self):
        """Invalid JWT → raises 401."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer invalid-token"}
        mock_session = MagicMock()

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.side_effect = HTTPException(status_code=401, detail="Invalid token")

            with pytest.raises(HTTPException) as exc:
                get_tenant_id(request, mock_session)
            assert exc.value.status_code == 401

    def test_jwt_missing_sub_claim_raises_401(self):
        """JWT without 'sub' claim → raises 401."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer dummy-token"}
        mock_session = MagicMock()

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.return_value = {"no_sub": "value"}

            with pytest.raises(HTTPException) as exc:
                get_tenant_id(request, mock_session)
            assert exc.value.status_code == 401


# ── get_current_tenant ────────────────────────────────────────────────────────


class TestGetCurrentTenant:
    """Test get_current_tenant dependency function (requires auth)."""

    def test_no_header_raises_401(self):
        """No Authorization header → raises 401."""
        request = MagicMock()
        request.headers = {}
        mock_session = MagicMock()

        with pytest.raises(HTTPException) as exc:
            get_current_tenant(request, mock_session)
        assert exc.value.status_code == 401
        assert "Authorization header required" in exc.value.detail

    def test_valid_jwt_no_mapping_raises_401(self):
        """Valid JWT but no user_tenant mapping → raises 401."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer dummy-token"}
        mock_session = MagicMock()

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "unknown-user"}
            mock_session.exec.return_value.first.return_value = None

            with pytest.raises(HTTPException) as exc:
                get_current_tenant(request, mock_session)
            assert exc.value.status_code == 401
            assert "no tenant assignment" in exc.value.detail

    def test_valid_jwt_with_mapping_returns_tenant_id(self):
        """Valid JWT + user_tenant mapping → returns tenant_id."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer dummy-token"}
        mock_session = MagicMock()

        mock_user_tenant = MagicMock()
        mock_user_tenant.tenant_id = "tenant-456"

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "test-user-002"}
            mock_session.exec.return_value.first.return_value = mock_user_tenant

            result = get_current_tenant(request, mock_session)
            assert result == "tenant-456"

    def test_expired_jwt_raises_401(self):
        """Expired JWT → raises 401."""
        request = MagicMock()
        request.headers = {"Authorization": "Bearer expired-token"}
        mock_session = MagicMock()

        with patch("app.api.dependencies._decode_jwt") as mock_decode:
            mock_decode.side_effect = HTTPException(status_code=401, detail="Token expired")

            with pytest.raises(HTTPException) as exc:
                get_current_tenant(request, mock_session)
            assert exc.value.status_code == 401
