"""Application factory used by the launcher, seed command, and tests."""

import flaskr.models  # noqa: F401 -- register models before create_all/migrations
from flask import Flask
from flask_smorest import Api
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from config import DevelopmentConfig
from flaskr.db import db
from flaskr.extensions import cors, jwt, migrate
from flaskr.routes.ai_route import bp as ai_route
from flaskr.routes.auth_route import bp as auth_route
from flaskr.routes.hr_route import bp as hr_route
from flaskr.routes.tag_route import bp as tag_route
from flaskr.routes.task_route import bp as task_route
from flaskr.routes.user_route import bp as user_route


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(DevelopmentConfig)
    if isinstance(test_config, dict):
        app.config.update(test_config)
    elif test_config is not None:
        app.config.from_object(test_config)

    db.init_app(app)
    migrate.init_app(app, db)
    api = Api(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    jwt.init_app(app)

    for blueprint in (auth_route, user_route, tag_route, task_route):
        api.register_blueprint(blueprint, url_prefix="/api/v1")
    app.register_blueprint(hr_route, url_prefix="/api/v1/hr")
    app.register_blueprint(ai_route, url_prefix="/api/v1/ai")

    @app.get("/api/v1/health")
    def health():
        db.session.execute(text("SELECT 1"))
        return {"status": "ok", "service": "vynixhr-backend", "database": "connected"}

    @app.errorhandler(HTTPException)
    def http_error(error):
        details = getattr(error, "data", {}) or {}
        payload = {
            "message": details.get("message", error.description),
            "code": error.code,
        }
        if "messages" in details:
            payload["errors"] = details["messages"]
        return payload, error.code

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.exception("Database operation failed")
        return {"message": "The database operation failed. Please try again."}, 500

    return app
