from flask import Flask

def create_app():
    app = Flask(__name__)
    from .routes import main_bp
    from .v2_routes import v2_app
    app.register_blueprint(v2_app)
    app.register_blueprint(main_bp)
    return app
