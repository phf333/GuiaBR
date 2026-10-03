import pytest

from app import create_app
from app.extensions import limiter
from app.models import db
from tests.conftest import TestConfig


def test_registro_cria_usuario_e_retorna_token(client):
    resp = client.post("/api/auth/register", json={
        "nome": "Ana", "email": "ana@x.com", "senha": "123456",
    })
    assert resp.status_code == 201
    body = resp.get_json()
    assert "access_token" in body
    assert body["usuario"]["email"] == "ana@x.com"


def test_registro_falha_com_senha_curta(client):
    resp = client.post("/api/auth/register", json={
        "nome": "Ana", "email": "ana@x.com", "senha": "123",
    })
    assert resp.status_code == 400


def test_registro_falha_com_campo_faltando(client):
    resp = client.post("/api/auth/register", json={"nome": "Ana", "senha": "123456"})
    assert resp.status_code == 400


def test_registro_falha_com_email_duplicado(client, registrar_usuario):
    registrar_usuario(email="dup@x.com")
    resp = client.post("/api/auth/register", json={
        "nome": "Outra Ana", "email": "dup@x.com", "senha": "123456",
    })
    assert resp.status_code == 409


def test_login_com_sucesso(client, registrar_usuario):
    registrar_usuario(email="login@x.com", senha="segredo1")
    resp = client.post("/api/auth/login", json={"email": "login@x.com", "senha": "segredo1"})
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()


def test_login_falha_com_senha_errada(client, registrar_usuario):
    registrar_usuario(email="login2@x.com", senha="segredo1")
    resp = client.post("/api/auth/login", json={"email": "login2@x.com", "senha": "errada"})
    assert resp.status_code == 401


def test_login_falha_com_email_inexistente(client):
    resp = client.post("/api/auth/login", json={"email": "naoexiste@x.com", "senha": "123456"})
    assert resp.status_code == 401


def test_me_retorna_dados_do_usuario_autenticado(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["email"] == "teste@x.com"


def test_me_sem_token_retorna_401(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.fixture
def client_com_rate_limit():
    class ConfigComRateLimit(TestConfig):
        RATELIMIT_ENABLED = True

    flask_app = create_app(ConfigComRateLimit)
    with flask_app.app_context():
        db.create_all()
        yield flask_app.test_client()
        db.drop_all()
    limiter.reset()


def test_login_bloqueia_apos_muitas_tentativas_na_mesma_conta(client_com_rate_limit):
    client = client_com_rate_limit
    client.post("/api/auth/register", json={"nome": "Alvo", "email": "alvo@x.com", "senha": "segredo1"})

    for _ in range(10):
        resp = client.post("/api/auth/login", json={"email": "alvo@x.com", "senha": "errada"})
        assert resp.status_code == 401

    resp = client.post("/api/auth/login", json={"email": "alvo@x.com", "senha": "segredo1"})
    assert resp.status_code == 429
    assert "error" in resp.get_json()

    # Outra conta não é afetada pelo bloqueio da primeira.
    resp = client.post("/api/auth/login", json={"email": "outra@x.com", "senha": "errada"})
    assert resp.status_code == 401
