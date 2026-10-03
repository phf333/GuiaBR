from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

# Armazenamento em memória: suficiente para um único processo Gunicorn (ver Dockerfile).
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")

migrate = Migrate()
