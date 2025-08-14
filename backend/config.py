"""Configuration for the local-first VynixHR application."""

import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    DEBUG = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_hex(32)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=4)
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///vynixhr.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 64 * 1024
    AI_URL = os.getenv(
        "AI_SERVICE_URL", os.getenv("AI_URL", "http://127.0.0.1:5001")
    ).rstrip("/")
    AI_TIMEOUT = 5
    API_TITLE = "VynixHR API"
    API_VERSION = "v1"
    OPENAPI_VERSION = "3.0.2"
    OPENAPI_URL_PREFIX = "/"
    OPENAPI_SWAGGER_UI_PATH = "/docs"
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


class DevelopmentConfig(Config):
    pass


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_SECRET_KEY = "test-only-secret-key-not-for-production"
