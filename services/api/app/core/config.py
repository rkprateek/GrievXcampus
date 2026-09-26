from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GrievX Campus API"
    app_version: str = "0.1.0"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://grievx:grievx_dev_password@localhost:5432/grievx"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "grievx"
    s3_access_key: str = "change_me"
    s3_secret_key: str = "change_me"
    cors_origins: list[str] = ["http://localhost:3000"]

    jwt_secret_key: str = "dev-only-change-this-secret-key-before-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
