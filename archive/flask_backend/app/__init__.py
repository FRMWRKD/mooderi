from flask import Flask
from config import Config

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    from app.models import db
    db.init_app(app)
    
    # Simple migration: Create tables if not exist
    with app.app_context():
        db.create_all()

    from app.routes import main
    app.register_blueprint(main)

    return app
