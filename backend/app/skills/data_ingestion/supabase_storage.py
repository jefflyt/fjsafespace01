"""
backend/app/services/supabase_storage.py

Supabase Storage helper for uploading and retrieving IAQ CSV scan files.

Usage:
    storage = SupabaseStorage()
    url = storage.upload_file(file_bytes, "upload-id.csv")
    content = storage.download_file("upload-id.csv")
"""

from io import BytesIO

from supabase import Client, create_client

from app.core.config import settings


class SupabaseStorageError(Exception):
    """Raised when a Supabase Storage operation fails."""


class SupabaseStorage:
    """Thin wrapper around the Supabase Python client for Storage operations."""

    def __init__(self) -> None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise SupabaseStorageError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured."
            )
        self._client: Client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
        self._bucket = settings.SUPABASE_STORAGE_BUCKET

    def upload_file(self, file_bytes: bytes, destination_path: str) -> str:
        """
        Upload raw bytes to the configured Supabase Storage bucket.

        Returns the public URL of the uploaded file.
        """
        try:
            result = self._client.storage.from_(self._bucket).upload(
                path=destination_path,
                file=file_bytes,
                file_options={"content_type": "text/csv", "cache_control": "no-cache"},
            )
            # Newer Supabase client returns {path, id}; older returns path string
            path = result.path if hasattr(result, "path") else result
        except Exception as e:
            raise SupabaseStorageError(f"Upload failed: {str(e)}") from e
        return self.get_public_url(path)

    def download_file(self, file_path: str) -> bytes:
        """Download a file from the bucket and return its raw bytes."""
        return self._client.storage.from_(self._bucket).download(file_path)

    def get_public_url(self, file_path: str) -> str:
        """Get the public URL for a file in the bucket."""
        return self._client.storage.from_(self._bucket).get_public_url(file_path)

    def delete_file(self, file_path: str) -> None:
        """Delete a file from the bucket."""
        self._client.storage.from_(self._bucket).remove([file_path])
