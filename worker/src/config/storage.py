import boto3
from .settings import (
    STORAGE_ENDPOINT_URL,
    STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY,
)

_storage_client = None


def get_storage_client():
    global _storage_client
    if _storage_client is None:
        _storage_client = boto3.client(
            "s3",
            endpoint_url=STORAGE_ENDPOINT_URL,
            aws_access_key_id=STORAGE_ACCESS_KEY_ID,
            aws_secret_access_key=STORAGE_SECRET_ACCESS_KEY,
        )
    return _storage_client
