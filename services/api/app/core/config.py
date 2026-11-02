from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GrievX Campus API"
    app_version: str = "0.1.0"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://grievx:grievx_dev_password@localhost:5432/grievx"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str = "http://localhost:8333"
    s3_bucket: str = "grievx"
    s3_access_key: str = "change_me"
    s3_secret_key: str = "change_me"
    cors_origins: list[str] = ["http://localhost:3000"]
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    jwt_secret_key: str = "dev-only-change-this-secret-key-before-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def parse_csv_settings(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.app_env.lower() != "production":
            return self
        problems: list[str] = []
        if len(self.jwt_secret_key) < 32 or self.jwt_secret_key.startswith("dev-only-"):
            problems.append("JWT_SECRET_KEY must be a unique secret of at least 32 characters")
        if "*" in self.cors_origins or not self.cors_origins:
            problems.append("CORS_ORIGINS must contain explicit trusted origins")
        if not self.allowed_hosts or "*" in self.allowed_hosts:
            problems.append("ALLOWED_HOSTS must contain explicit hostnames")
        if not self.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
            problems.append("DATABASE_URL must use PostgreSQL in production")
        if "localhost" in self.database_url or "127.0.0.1" in self.database_url:
            problems.append("DATABASE_URL must point to a managed/remote database in production")
        if not self.s3_endpoint.startswith("https://"):
            problems.append("S3_ENDPOINT must use HTTPS in production")
        if self.s3_access_key in {"", "change_me"} or self.s3_secret_key in {"", "change_me"}:
            problems.append("S3 credentials must be configured in production")
        if problems:
            raise ValueError("Invalid production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
