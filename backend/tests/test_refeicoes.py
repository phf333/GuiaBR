from app.models import db, Alimento


def _criar_alimento(app, nome="Arroz", grupo="CEREAIS"):
    with app.app_context():
        alimento = Alimento(nome=nome, grupo=grupo)
        db.session.add(alimento)
        db.session.commit()
        return alimento.id


def test_criar_refeicao(client, auth_headers):
    resp = client.post("/api/refeicoes", json={
        "nome_refeicao": "Almoço de terça", "tipo_refeicao": "almoco",
    }, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.get_json()["nome_refeicao"] == "Almoço de terça"


def test_criar_refeicao_falha_com_tipo_invalido(client, auth_headers):
    resp = client.post("/api/refeicoes", json={
        "nome_refeicao": "Almoço", "tipo_refeicao": "invalido",
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_criar_refeicao_falha_sem_nome(client, auth_headers):
    resp = client.post("/api/refeicoes", json={"tipo_refeicao": "almoco"}, headers=auth_headers)
    assert resp.status_code == 400


def test_listar_refeicoes_retorna_apenas_do_usuario(client, registrar_usuario):
    _, headers1 = registrar_usuario(email="u1@x.com")
    _, headers2 = registrar_usuario(email="u2@x.com")

    client.post("/api/refeicoes", json={"nome_refeicao": "Refeição A", "tipo_refeicao": "almoco"}, headers=headers1)
    client.post("/api/refeicoes", json={"nome_refeicao": "Refeição B", "tipo_refeicao": "jantar"}, headers=headers2)

    resp = client.get("/api/refeicoes", headers=headers1)
    nomes = [r["nome_refeicao"] for r in resp.get_json()]
    assert nomes == ["Refeição A"]


def test_usuario_nao_acessa_refeicao_de_outro(client, registrar_usuario):
    _, headers1 = registrar_usuario(email="dono@x.com")
    _, headers2 = registrar_usuario(email="intruso@x.com")

    criada = client.post("/api/refeicoes", json={
        "nome_refeicao": "Privada", "tipo_refeicao": "almoco",
    }, headers=headers1).get_json()

    resp = client.get(f"/api/refeicoes/{criada['id']}", headers=headers2)
    assert resp.status_code == 404


def test_usuario_nao_deleta_refeicao_de_outro(client, registrar_usuario):
    _, headers1 = registrar_usuario(email="dono2@x.com")
    _, headers2 = registrar_usuario(email="intruso2@x.com")

    criada = client.post("/api/refeicoes", json={
        "nome_refeicao": "Privada", "tipo_refeicao": "almoco",
    }, headers=headers1).get_json()

    resp = client.delete(f"/api/refeicoes/{criada['id']}", headers=headers2)
    assert resp.status_code == 404


def test_adicionar_e_remover_item(client, auth_headers, app):
    alimento_id = _criar_alimento(app)

    criada = client.post("/api/refeicoes", json={
        "nome_refeicao": "Refeição", "tipo_refeicao": "almoco",
    }, headers=auth_headers).get_json()

    resp = client.post(f"/api/refeicoes/{criada['id']}/itens", json={
        "alimento_id": alimento_id,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["total_itens"] == 1

    resp = client.delete(f"/api/refeicoes/{criada['id']}/itens/{alimento_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["total_itens"] == 0


def test_adicionar_item_com_alimento_inexistente_retorna_404(client, auth_headers):
    criada = client.post("/api/refeicoes", json={
        "nome_refeicao": "Refeição", "tipo_refeicao": "almoco",
    }, headers=auth_headers).get_json()

    resp = client.post(f"/api/refeicoes/{criada['id']}/itens", json={"alimento_id": 9999}, headers=auth_headers)
    assert resp.status_code == 404
