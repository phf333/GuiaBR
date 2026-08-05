from flask_jwt_extended import create_access_token


def test_listar_capitulos_cria_progresso_inicial(client, auth_headers):
    resp = client.get("/api/capitulos", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert [c["numero"] for c in body] == [1, 2, 3, 4, 5, 6]
    assert all(c["status"] == "active" for c in body)


def test_listar_capitulos_sem_token_retorna_401(client):
    resp = client.get("/api/capitulos")
    assert resp.status_code == 401


def test_listar_capitulos_usuario_inexistente_retorna_404(client, app):
    with app.app_context():
        token = create_access_token(identity="99999")
    resp = client.get("/api/capitulos", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


def test_concluir_capitulo_marca_como_done(client, auth_headers):
    client.get("/api/capitulos", headers=auth_headers)

    resp = client.post("/api/capitulos/2/concluir", headers=auth_headers)
    assert resp.status_code == 200
    status_map = {c["numero"]: c["status"] for c in resp.get_json()}
    assert status_map[2] == "done"
    assert status_map[1] == "active"


def test_concluir_capitulo_numero_fora_da_lista_nao_quebra(client, auth_headers):
    resp = client.post("/api/capitulos/99/concluir", headers=auth_headers)
    assert resp.status_code == 200
    assert all(c["status"] != "done" for c in resp.get_json())


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
