from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import requests

from app.models import db, Alimento, HistoricoScanner, Sazonalidade, mes_atual


def _off_response(status_code=200, payload=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = payload or {}
    return resp


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_desconhecido_consulta_off_e_cria_alimento(mock_get, client, auth_headers):
    mock_get.return_value = _off_response(200, {
        "product": {
            "product_name": "Suco de Uva Integral", "nova_group": 1,
            "brands": "Marca", "quantity": "1 L", "image_url": "http://img/x.jpg",
            "ingredients_text": "campo que o app não usa",
        },
    })

    resp = client.get("/api/alimentos/busca?codigo=7891000100103", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.get_json() == {
        "codigo_barras": "7891000100103",
        "nome": "Suco de Uva Integral",
        "marca": "Marca",
        "quantidade": "1 L",
        "nova_group": 1,
        "classificacao_guia": "in natura",
        "imagem_url": "http://img/x.jpg",
    }
    mock_get.assert_called_once()


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_guarda_a_resposta_completa_do_off(mock_get, client, auth_headers, app):
    payload = {"product": {"product_name": "Suco", "nova_group": 1, "ingredients_text": "uva"}}
    mock_get.return_value = _off_response(200, payload)

    resp = client.get("/api/alimentos/busca?codigo=7891000100103", headers=auth_headers)

    assert "ingredients_text" not in resp.get_json()
    with app.app_context():
        alimento = Alimento.query.filter_by(codigo_barras="7891000100103").one()
        assert alimento.dados_completos == payload


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_ja_cacheado_devolve_os_campos_do_produto(mock_get, client, auth_headers, app):
    with app.app_context():
        db.session.add(Alimento(
            nome="Refrigerante X",
            grupo="OFF - Marca",
            classificacao_guia="ultraprocessado",
            codigo_barras="789001",
            dados_completos={"product": {
                "product_name": "Refrigerante X", "nova_group": 4,
                "brands": "Marca", "quantity": "2 L", "image_front_url": "http://img/r.jpg",
            }},
        ))
        db.session.commit()

    body = client.get("/api/alimentos/busca?codigo=789001", headers=auth_headers).get_json()

    assert body["marca"] == "Marca"
    assert body["quantidade"] == "2 L"
    assert body["nova_group"] == 4
    assert body["classificacao_guia"] == "ultraprocessado"
    assert body["imagem_url"] == "http://img/r.jpg"
    mock_get.assert_not_called()


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_ja_cacheado_nao_chama_off(mock_get, client, auth_headers, app):
    with app.app_context():
        alimento = Alimento(
            nome="Refrigerante X",
            grupo="OFF - Marca",
            classificacao_guia="ultraprocessado",
            codigo_barras="789000",
            dados_completos={"product": {"product_name": "Refrigerante X", "nova_group": 4}},
        )
        db.session.add(alimento)
        db.session.commit()

    resp = client.get("/api/alimentos/busca?codigo=789000", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.get_json()["nome"] == "Refrigerante X"
    assert resp.get_json()["classificacao_guia"] == "ultraprocessado"
    mock_get.assert_not_called()


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_nao_encontrado_no_off_retorna_404(mock_get, client, auth_headers):
    mock_get.return_value = _off_response(404, {})

    resp = client.get("/api/alimentos/busca?codigo=0000000", headers=auth_headers)

    assert resp.status_code == 404


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_com_erro_de_rede_retorna_500(mock_get, client, auth_headers):
    mock_get.side_effect = requests.exceptions.ConnectionError("timeout")

    resp = client.get("/api/alimentos/busca?codigo=123", headers=auth_headers)

    assert resp.status_code == 500


@patch("app.routes.alimentos.requests.get")
def test_busca_por_codigo_nao_numerico_retorna_400_sem_chamar_off(mock_get, client, auth_headers):
    resp = client.get("/api/alimentos/busca?codigo=../../cgi/x", headers=auth_headers)

    assert resp.status_code == 400
    mock_get.assert_not_called()


def test_busca_sem_parametros_retorna_400(client, auth_headers):
    resp = client.get("/api/alimentos/busca", headers=auth_headers)
    assert resp.status_code == 400


def test_todos_retorna_apenas_alimentos_sem_codigo_de_barras(client, auth_headers, app):
    with app.app_context():
        db.session.add(Alimento(nome="Feijão Preto", grupo="LEGUMINOSAS"))
        db.session.add(Alimento(nome="Produto Escaneado", grupo="OFF - Marca", codigo_barras="123456"))
        db.session.commit()

    resp = client.get("/api/alimentos/todos", headers=auth_headers)

    assert resp.status_code == 200
    nomes = [a["nome"] for a in resp.get_json()]
    assert nomes == ["Feijão Preto"]


def test_todos_inclui_sazonalidade_atual(client, auth_headers, app):
    with app.app_context():
        alimento = Alimento(nome="Manga", grupo="FRUTAS")
        db.session.add(alimento)
        db.session.flush()
        db.session.add(Sazonalidade(alimento_id=alimento.id, mes=mes_atual(), safra_atual=4))
        db.session.commit()

    resp = client.get("/api/alimentos/todos", headers=auth_headers)

    body = resp.get_json()
    assert body[0]["sazonalidade_atual"]["nivel"] == "alta"


def test_historico_retorna_consultas_do_usuario_ordenadas_por_data(client, registrar_usuario, app):
    usuario, headers = registrar_usuario(email="hist@x.com")

    with app.app_context():
        a1 = Alimento(nome="Item Antigo", grupo="OUTROS", codigo_barras="111")
        a2 = Alimento(nome="Item Novo", grupo="OUTROS", codigo_barras="222")
        db.session.add_all([a1, a2])
        db.session.commit()
        db.session.add(HistoricoScanner(
            usuario_id=usuario["id"], alimento_id=a1.id,
            data_consulta=datetime.utcnow() - timedelta(days=1),
        ))
        db.session.add(HistoricoScanner(
            usuario_id=usuario["id"], alimento_id=a2.id,
            data_consulta=datetime.utcnow(),
        ))
        db.session.commit()

    resp = client.get("/api/alimentos/historico", headers=headers)

    assert resp.status_code == 200
    historico = resp.get_json()
    assert [h["nome"] for h in historico] == ["Item Novo", "Item Antigo"]
    assert set(historico[0]) == {
        "codigo_barras", "nome", "marca", "quantidade", "nova_group",
        "classificacao_guia", "imagem_url", "data_consulta",
    }


def test_historico_nao_mostra_consultas_de_outro_usuario(client, registrar_usuario, app):
    dono, headers_dono = registrar_usuario(email="dono3@x.com")
    _, headers_outro = registrar_usuario(email="outro3@x.com")

    with app.app_context():
        alimento = Alimento(nome="Item", grupo="OUTROS", codigo_barras="333")
        db.session.add(alimento)
        db.session.commit()
        db.session.add(HistoricoScanner(usuario_id=dono["id"], alimento_id=alimento.id))
        db.session.commit()

    resp = client.get("/api/alimentos/historico", headers=headers_outro)

    assert resp.get_json() == []


def test_deletar_historico_remove_item(client, registrar_usuario, app):
    usuario, headers = registrar_usuario(email="del@x.com")

    with app.app_context():
        alimento = Alimento(nome="Item", grupo="OUTROS", codigo_barras="444")
        db.session.add(alimento)
        db.session.commit()
        db.session.add(HistoricoScanner(usuario_id=usuario["id"], alimento_id=alimento.id))
        db.session.commit()

    resp = client.delete("/api/alimentos/historico/444", headers=headers)
    assert resp.status_code == 200

    resp2 = client.get("/api/alimentos/historico", headers=headers)
    assert resp2.get_json() == []


def test_deletar_historico_com_codigo_desconhecido_retorna_404(client, auth_headers):
    resp = client.delete("/api/alimentos/historico/000000", headers=auth_headers)
    assert resp.status_code == 404


def test_deletar_historico_sem_entrada_para_o_usuario_retorna_404(client, auth_headers, app):
    with app.app_context():
        db.session.add(Alimento(nome="Item", grupo="OUTROS", codigo_barras="555"))
        db.session.commit()

    resp = client.delete("/api/alimentos/historico/555", headers=auth_headers)
    assert resp.status_code == 404
