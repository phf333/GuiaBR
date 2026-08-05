import os
import datetime

class Config:
    FLASK_ENV = os.environ.get('FLASK_ENV') or 'development'

    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        if FLASK_ENV == 'production':
            raise RuntimeError("A variável de ambiente SECRET_KEY precisa estar definida em produção!")
        SECRET_KEY = 'dev_secret_key_123'

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    if not JWT_SECRET_KEY:
        if FLASK_ENV == 'production':
            raise RuntimeError("A variável de ambiente JWT_SECRET_KEY precisa estar definida em produção!")
        JWT_SECRET_KEY = 'jwt_secret_key_123'

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        if FLASK_ENV == 'production':
            raise RuntimeError("A variável de ambiente DATABASE_URL precisa estar definida em produção!")
        SQLALCHEMY_DATABASE_URI = 'postgresql://postgres:password123@localhost:5433/alimentos'

    JWT_ACCESS_TOKEN_EXPIRES = datetime.timedelta(days=7)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

