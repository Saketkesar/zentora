from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Zentora API"
    JWT_SECRET: str = "dev-secret-change"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_SECRET: str = "dev-refresh-secret-change"
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Default to SQLite for local dev; overridden by env in Docker Compose
    DATABASE_URL: str = "sqlite:///./data/zentora.db"
    # Default seed credentials for local dev (can be overridden via env)
    ADMIN_EMAIL: str | None = "admin@zentora.local"
    ADMIN_PASSWORD: str | None = "Admin@12345"
    POLICE_EMAIL: str | None = "police@zentora.local"
    POLICE_PASSWORD: str | None = "Police@12345"
    # Optional Ganache
    GANACHE_RPC_URL: str | None = None
    GANACHE_PRIVATE_KEY: str | None = None

settings = Settings()
