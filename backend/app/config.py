import json
import os
from typing import List, Union
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/task_harness"

    # Redis Pub/Sub
    REDIS_URL: str = "redis://localhost:6379/0"

    # Google Gemini API
    GEMINI_API_KEY: str = Field(default="")
    GOOGLE_API_KEY: str = Field(default="")
    ROUTER_MODEL: str = "gemini-2.5-flash"
    AGENT_MODEL: str = "gemini-2.5-flash"

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
