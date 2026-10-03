from flask import Blueprint, current_app, jsonify, request
import re
import requests
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload, selectinload
from app.models import db, Alimento, HistoricoScanner, Sazonalidade, mes_atual

alimentos_bp = Blueprint('alimentos', __name__)


def _registrar_historico(usuario_id: int, alimento_id: int):
    """Registra ou atualiza o alimento no histórico do scanner do usuário."""
    historico_existente = HistoricoScanner.query.filter_by(
        usuario_id=usuario_id,
        alimento_id=alimento_id
    ).first()

    if historico_existente:
        historico_existente.data_consulta = db.func.current_timestamp()
    else:
        novo_historico = HistoricoScanner(usuario_id=usuario_id, alimento_id=alimento_id)
        db.session.add(novo_historico)
    
    db.session.commit()


def _classificar_por_nova_group(nova_group) -> str:
    """Converte o grupo NOVA (1-4) da OFF na classificação usada pelo Guia Alimentar."""
    mapa = {
        1: 'in natura',
        2: 'ingrediente culinario',
        3: 'processado',
        4: 'ultraprocessado',
    }
    return mapa.get(nova_group, 'indisponivel')


def _extrair_dados_off(product: dict) -> dict:
    """Seleciona, da resposta do Open Food Facts, só o que o app exibe."""
    return {
        'marca': product.get('brands') or None,
        'quantidade': product.get('quantity') or None,
        'nova_group': product.get('nova_group'),
        'imagem_url': product.get('image_url')
                      or product.get('image_front_thumb_url')
                      or product.get('image_front_url'),
    }


def _serializar_produto(al: Alimento) -> dict:
    """Resposta enxuta para o app; dados_completos guarda a resposta inteira do OFF."""
    dados = _extrair_dados_off((al.dados_completos or {}).get('product', {}))
    nova_group = dados.get('nova_group')
    return {
        'codigo_barras': al.codigo_barras,
        'nome': al.nome,
        'marca': dados.get('marca'),
        'quantidade': dados.get('quantidade'),
        'nova_group': nova_group,
        'classificacao_guia': _classificar_por_nova_group(nova_group),
        'imagem_url': dados.get('imagem_url'),
    }


def _serializar_alimento(al: Alimento) -> dict:
    return {
        'id': al.id,
        'nome': al.nome,
        'grupo': al.grupo,
        'classificacao_guia': al.classificacao_guia,
        'sazonalidade_atual': al.sazonalidade_atual,
    }


@alimentos_bp.route('/busca', methods=['GET'])
@jwt_required()
def buscar_alimento():
    codigo = request.args.get('codigo')
    query = request.args.get('q')
    so_safra = request.args.get('safra', 'false').lower() == 'true'
    usuario_id = int(get_jwt_identity())

    if codigo:
        # O código entra na URL do Open Food Facts; só dígitos (EAN/UPC têm até 14).
        if not re.fullmatch(r'[0-9]{1,14}', codigo):
            return jsonify({"error": "Código de barras inválido"}), 400

        alimento = Alimento.query.filter_by(codigo_barras=codigo).first()
        
        if alimento and alimento.dados_completos:
            _registrar_historico(usuario_id, alimento.id)
            return jsonify(_serializar_produto(alimento))

        off_url = f"https://world.openfoodfacts.org/api/v3/product/{codigo}.json"
        headers = {
            'User-Agent': 'GuiaBR/1.0 (contact@example.com)'
        }
        try:
            res = requests.get(off_url, headers=headers, timeout=5)
            if res.status_code != 200:
                return jsonify({"error": f"Produto não encontrado na API do Open Food Facts (Status: {res.status_code})"}), 404
            
            data = res.json()
            if 'product' not in data or data.get('status') == 'failure':
                return jsonify({"error": "Produto não encontrado"}), 404
            
            product = data['product']
            nome = product.get('product_name') or 'Produto desconhecido'
            classificacao = _classificar_por_nova_group(product.get('nova_group'))

            if alimento:
                alimento.dados_completos = data
                alimento.nome = nome
                alimento.grupo = 'OFF - ' + (product.get('brands') or 'Desconhecido')
                alimento.classificacao_guia = classificacao
            else:
                alimento = Alimento(
                    nome=nome,
                    grupo='OFF - ' + (product.get('brands') or 'Desconhecido'),
                    classificacao_guia=classificacao,
                    codigo_barras=codigo,
                    dados_completos=data
                )
                db.session.add(alimento)
            
            try:
                db.session.commit()
            except IntegrityError:
                # Outra requisição cadastrou o mesmo código de barras ao mesmo tempo.
                db.session.rollback()
                alimento = Alimento.query.filter_by(codigo_barras=codigo).first()

            _registrar_historico(usuario_id, alimento.id)

            return jsonify(_serializar_produto(alimento))

        except requests.exceptions.RequestException:
            current_app.logger.exception("Erro de rede ao consultar o Open Food Facts")
            return jsonify({"error": "Erro de rede ao conectar à API do Open Food Facts"}), 500

    elif query:
        q = Alimento.query.options(selectinload(Alimento.safras)).filter(
            Alimento.nome.ilike(f"%{query}%"),
            Alimento.codigo_barras.is_(None)
        )

        if so_safra:
            q = q.join(Sazonalidade, Alimento.id == Sazonalidade.alimento_id)\
                 .filter(Sazonalidade.mes == mes_atual(), Sazonalidade.safra_atual >= 3)

        alimentos = q.limit(50).all()
        return jsonify([_serializar_alimento(al) for al in alimentos])

    return jsonify({"error": "Parâmetro 'codigo' ou 'q' é obrigatório"}), 400

@alimentos_bp.route('/historico', methods=['GET'])
@jwt_required()
def obter_historico():
    usuario_id = int(get_jwt_identity())

    historico = HistoricoScanner.query.filter_by(usuario_id=usuario_id)\
        .options(joinedload(HistoricoScanner.alimento))\
        .order_by(HistoricoScanner.data_consulta.desc()).limit(20).all()

    return jsonify([
        {**_serializar_produto(h.alimento), 'data_consulta': h.data_consulta.isoformat()}
        for h in historico if h.alimento
    ])

@alimentos_bp.route('/todos', methods=['GET'])
@jwt_required()
def obter_todos():
    # Exclui itens escaneados (identificados por terem código de barras) da lista
    # usada para sugestão de montagem de prato — só entram alimentos do Guia Alimentar.
    alimentos = Alimento.query.options(selectinload(Alimento.safras)) \
        .filter(Alimento.codigo_barras.is_(None)).all()
    return jsonify([_serializar_alimento(al) for al in alimentos])

@alimentos_bp.route('/historico/<string:codigo_barras>', methods=['DELETE'])
@jwt_required()
def deletar_historico(codigo_barras):
    usuario_id = int(get_jwt_identity())
    alimento = Alimento.query.filter_by(codigo_barras=codigo_barras).first()
    if not alimento:
        return jsonify({'error': 'Alimento não encontrado'}), 404
        
    historico = HistoricoScanner.query.filter_by(
        usuario_id=usuario_id,
        alimento_id=alimento.id
    ).first()
    
    if not historico:
        return jsonify({'error': 'Item não encontrado no histórico'}), 404
        
    db.session.delete(historico)
    db.session.commit()
    return jsonify({'message': 'Item removido do histórico com sucesso'})
