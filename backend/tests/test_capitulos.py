from flask_jwt_extended import create_access_token

from app.models import ProgressoCapitulo


def test_listar_capitulos_devolve_todos_como_active_sem_gravar_nada(client, auth_headers, app):
    resp = client.get("/api/capitulos", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert [c["numero"] for c in body] == [1, 2, 3, 4, 5, 6]
    assert all(c["status"] == "active" for c in body)
    with app.app_context():
        assert ProgressoCapitulo.query.count() == 0


def test_listar_capitulos_sem_token_retorna_401(client):
    resp = client.get("/api/capitulos")
    assert resp.status_code == 401


def test_listar_capitulos_usuario_inexistente_retorna_404(client, app):
    with app.app_context():
        token = create_access_token(identity="99999")
    resp = client.get("/api/capitulos", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


def test_concluir_capitulo_marca_como_done(client, auth_headers):
    resp = client.post("/api/capitulos/2/concluir", headers=auth_headers)
    assert resp.status_code == 200
    status_map = {c["numero"]: c["status"] for c in resp.get_json()}
    assert status_map[2] == "done"
    assert status_map[1] == "active"

    status_map = {c["numero"]: c["status"] for c in client.get("/api/capitulos", headers=auth_headers).get_json()}
    assert status_map[2] == "done"


def test_concluir_capitulo_duas_vezes_e_idempotente(client, auth_headers, app):
    client.post("/api/capitulos/2/concluir", headers=auth_headers)
    resp = client.post("/api/capitulos/2/concluir", headers=auth_headers)

    assert resp.status_code == 200
    with app.app_context():
        assert ProgressoCapitulo.query.count() == 1


def test_concluir_capitulo_aproveita_linha_active_de_versao_anterior(client, registrar_usuario, app):
    usuario, headers = registrar_usuario(email="antigo@x.com")
    with app.app_context():
        from app.models import db
        db.session.add(ProgressoCapitulo(usuario_id=usuario["id"], capitulo_numero=2, status="active"))
        db.session.commit()

    status_map = {c["numero"]: c["status"] for c in client.get("/api/capitulos", headers=headers).get_json()}
    assert status_map[2] == "active"

    resp = client.post("/api/capitulos/2/concluir", headers=headers)
    status_map = {c["numero"]: c["status"] for c in resp.get_json()}
    assert status_map[2] == "done"


def test_concluir_capitulo_numero_fora_da_lista_retorna_404(client, auth_headers):
    resp = client.post("/api/capitulos/99/concluir", headers=auth_headers)
    assert resp.status_code == 404


def test_concluir_capitulo_usuario_inexistente_retorna_404(client, app):
    with app.app_context():
        token = create_access_token(identity="99999")
    resp = client.post("/api/capitulos/1/concluir", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


def test_resetar_progresso_volta_tudo_para_active(client, auth_headers):
    client.post("/api/capitulos/3/concluir", headers=auth_headers)
    client.post("/api/capitulos/5/concluir", headers=auth_headers)

    resp = client.post("/api/capitulos/reset", headers=auth_headers)
    assert resp.status_code == 200
    assert all(c["status"] == "active" for c in resp.get_json())


def test_progresso_e_isolado_por_usuario(client, registrar_usuario):
    _, headers1 = registrar_usuario(email="cap1@x.com")
    _, headers2 = registrar_usuario(email="cap2@x.com")

    client.post("/api/capitulos/1/concluir", headers=headers1)

    resp2 = client.get("/api/capitulos", headers=headers2)
    status_map2 = {c["numero"]: c["status"] for c in resp2.get_json()}
    assert status_map2[1] == "active"


def _por_numero(resp):
    return {c["numero"]: c for c in resp.get_json()}


def test_listar_capitulos_inclui_ultimo_card_zerado(client, auth_headers):
    capitulos = _por_numero(client.get("/api/capitulos", headers=auth_headers))
    assert all(c["ultimo_card"] == 0 for c in capitulos.values())


def test_salvar_posicao_guarda_o_ultimo_card_sem_concluir(client, auth_headers):
    resp = client.post("/api/capitulos/2/posicao", json={"ultimo_card": 3}, headers=auth_headers)
    assert resp.status_code == 200

    capitulos = _por_numero(client.get("/api/capitulos", headers=auth_headers))
    assert capitulos[2] == {"numero": 2, "status": "active", "ultimo_card": 3}
    assert capitulos[1]["ultimo_card"] == 0


def test_salvar_posicao_substitui_a_anterior(client, auth_headers, app):
    client.post("/api/capitulos/2/posicao", json={"ultimo_card": 3}, headers=auth_headers)
    client.post("/api/capitulos/2/posicao", json={"ultimo_card": 1}, headers=auth_headers)

    capitulos = _por_numero(client.get("/api/capitulos", headers=auth_headers))
    assert capitulos[2]["ultimo_card"] == 1
    with app.app_context():
        assert ProgressoCapitulo.query.count() == 1


def test_posicao_e_conclusao_convivem_na_mesma_linha(client, auth_headers, app):
    client.post("/api/capitulos/2/posicao", json={"ultimo_card": 4}, headers=auth_headers)
    client.post("/api/capitulos/2/concluir", headers=auth_headers)
    client.post("/api/capitulos/2/posicao", json={"ultimo_card": 2}, headers=auth_headers)

    capitulos = _por_numero(client.get("/api/capitulos", headers=auth_headers))
    assert capitulos[2] == {"numero": 2, "status": "done", "ultimo_card": 2}
    with app.app_context():
        assert ProgressoCapitulo.query.count() == 1


def test_salvar_posicao_rejeita_valor_invalido(client, auth_headers):
    for invalido in (-1, 1000, "3", 2.5, True, None):
        resp = client.post("/api/capitulos/2/posicao", json={"ultimo_card": invalido}, headers=auth_headers)
        assert resp.status_code == 400, invalido

    assert client.post("/api/capitulos/2/posicao", headers=auth_headers).status_code == 400


def test_salvar_posicao_capitulo_inexistente_retorna_404(client, auth_headers):
    resp = client.post("/api/capitulos/99/posicao", json={"ultimo_card": 1}, headers=auth_headers)
    assert resp.status_code == 404


def test_salvar_posicao_sem_token_retorna_401(client):
    assert client.post("/api/capitulos/2/posicao", json={"ultimo_card": 1}).status_code == 401


def test_resetar_progresso_zera_as_posicoes(client, auth_headers):
    client.post("/api/capitulos/2/posicao", json={"ultimo_card": 3}, headers=auth_headers)

    resp = client.post("/api/capitulos/reset", headers=auth_headers)

    assert all(c["ultimo_card"] == 0 for c in resp.get_json())


def test_posicao_e_isolada_por_usuario(client, registrar_usuario):
    _, headers1 = registrar_usuario(email="pos1@x.com")
    _, headers2 = registrar_usuario(email="pos2@x.com")

    client.post("/api/capitulos/1/posicao", json={"ultimo_card": 2}, headers=headers1)

    assert _por_numero(client.get("/api/capitulos", headers=headers2))[1]["ultimo_card"] == 0
