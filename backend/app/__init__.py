import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.config import Config
from app.extensions import limiter, migrate
from app.models import db

def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    # Configura CORS para permitir chamadas do Angular — aplicado globalmente
    # para que respostas de erro (4xx/5xx) também carreguem o header CORS
    allowed_origins = os.environ.get('ALLOWED_ORIGINS')
    if allowed_origins:
        origins = [o.strip() for o in allowed_origins.split(',')]
    else:
        origins = [
            "http://localhost:4200",
            "https://localhost:4200",
            "http://127.0.0.1:4200",
            "https://127.0.0.1:4200",
            "http://192.168.1.233:4200",
            "https://192.168.1.233:4200"
        ]
    CORS(app, origins=origins)

    db.init_app(app)
    migrate.init_app(app, db)
    JWTManager(app)
    limiter.init_app(app)

    @app.errorhandler(429)
    def limite_excedido(_erro):
        return jsonify({'error': 'Muitas tentativas. Aguarde um minuto e tente novamente.'}), 429

    # Registro de Blueprints
    from app.routes.alimentos import alimentos_bp
    from app.routes.capitulos import capitulos_bp
    from app.routes.auth import auth_bp
    from app.routes.refeicoes import refeicoes_bp

    app.register_blueprint(alimentos_bp, url_prefix='/api/alimentos')
    app.register_blueprint(capitulos_bp, url_prefix='/api/capitulos')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(refeicoes_bp, url_prefix='/api/refeicoes')

    @app.after_request
    def add_header(response):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response

    return app
