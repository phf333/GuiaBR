import pytest
from sqlalchemy.pool import StaticPool

from app import create_app
from app.models import db as _db


class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "test-secret"
    JWT_SECRET_KEY = "test-secret"
    RATELIMIT_ENABLED = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "poolclass": StaticPool,
        "connect_args": {"check_same_thread": False},
    }


@pytest.fixture
def app():
    flask_app = create_app(TestConfig)
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def registrar_usuario(client):
    """Registra um usuário e devolve (dados_do_usuario, headers_de_auth)."""
    def _registrar(nome="Teste", email="teste@x.com", senha="123456"):
        resp = client.post("/api/auth/register", json={
            "nome": nome, "email": email, "senha": senha,
        })
        body = resp.get_json()
        headers = {"Authorization": f"Bearer {body['access_token']}"}
        return body["usuario"], headers
    return _registrar


@pytest.fixture
def auth_headers(registrar_usuario):
    _, headers = registrar_usuario()
    return headers
