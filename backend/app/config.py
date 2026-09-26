import json
import os
from typing import List, Union
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///task_harness.db",
        description="Async database connection string. Accepts postgresql+asyncpg:// or sqlite+aiosqlite:///"
    )

    # Redis Pub/Sub (Optional for hackathon demo; backend uses in-memory event bus when empty)
    REDIS_URL: str = Field(default="", description="Optional Redis URL")

    # Google Gemini API
    GEMINI_API_KEY: str = Field(default="")
    GOOGLE_API_KEY: str = Field(default="")
    ROUTER_MODEL: str = "gemini-flash-latest"
    AGENT_MODEL: str = "gemini-flash-latest"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            return "sqlite+aiosqlite:///task_harness.db"
        # Render / Supabase / Neon often provide postgres:// or postgresql://
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Calendar Integration (Real external API or sandbox)
    CALENDAR_API_BASE_URL: str = "https://api.calendardemo.local/v1"
    CALENDAR_API_KEY: str = "sandbox_key_demo"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["*"]

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @model_validator(mode="after")
    def sync_api_keys(self) -> "Settings":
        if not self.GEMINI_API_KEY and self.GOOGLE_API_KEY:
            self.GEMINI_API_KEY = self.GOOGLE_API_KEY
        elif self.GEMINI_API_KEY and not self.GOOGLE_API_KEY:
            self.GOOGLE_API_KEY = self.GEMINI_API_KEY
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
