from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Core
    jwt_secret: str = "change-this-to-a-secure-256-bit-secret-in-production"
    jwt_expiration_ms: int = 86400000
    upload_dir: str = "./uploads"
    ai_service_url: str = "http://localhost:8000/api"
    database_url: str = "sqlite:///./meetingai.db"
    frontend_url: str = "http://localhost:5173"

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_business_price_id: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
