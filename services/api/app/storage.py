from functools import lru_cache
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class ObjectStorage:
    def __init__(self) -> None:
        settings = get_settings()
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name="us-east-1",
        )

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            if error_code not in {"404", "NoSuchBucket", "NotFound"}:
                raise
            self.client.create_bucket(Bucket=self.bucket)

    def upload_image(self, content: bytes, content_type: str, filename: str) -> str:
        self.ensure_bucket()
        safe_suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        object_key = f"complaints/{uuid4()}.{safe_suffix}"
        self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
        return object_key


@lru_cache
def get_object_storage() -> ObjectStorage:
    return ObjectStorage()
