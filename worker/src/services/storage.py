from src.config import get_storage_client, STORAGE_BUCKET_NAME


def download_file(key: str) -> bytes:
    client = get_storage_client()
    response = client.get_object(Bucket=STORAGE_BUCKET_NAME, Key=key)
    return response["Body"].read()


def upload_file(key: str, content: str, content_type: str = "text/html; charset=utf-8") -> str:
    client = get_storage_client()
    client.put_object(
        Bucket=STORAGE_BUCKET_NAME,
        Key=key,
        Body=content.encode("utf-8"),
        ContentType=content_type,
        ContentEncoding="utf-8",
    )
    return key
