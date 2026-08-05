from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload
from app.models import db, Refeicao, ItensRefeicao, Alimento

refeicoes_bp = Blueprint('refeicoes', __name__)

TIPOS_VALIDOS = {'cafe_manha', 'lanche', 'almoco', 'jantar'}

# ---------------------------------------------------------------------------
# Checklists por tipo de refeição (baseados no Guia Alimentar 2014)
# Cada critério: { id, label, obrigatorio, dica }
# ---------------------------------------------------------------------------
CHECKLISTS = {
    'cafe_manha': [
        {'id': 'fruta',            'label': 'Fruta in natura',         'obrigatorio': True,  'dica': 'Inclua ao menos uma fruta fresca'},
        {'id': 'cereal_tuberculo', 'label': 'Cereal ou tubérculo',     'obrigatorio': True,  'dica': 'Ex: aveia, tapioca, pão integral, mandioca'},
        {'id': 'sem_ultraprocessado', 'label': 'Sem ultraprocessados', 'obrigatorio': True,  'dica': 'Evite achocolatados, cereais açucarados, margarinas'},
    ],
    'lanche': [
        {'id': 'fruta',            'label': 'Fruta in natura',         'obrigatorio': True,  'dica': 'Inclua ao menos uma fruta fresca'},
        {'id': 'sem_ultraprocessado', 'label': 'Sem ultraprocessados', 'obrigatorio': True,  'dica': 'Prefira frutas e oleaginosas a biscoitos e salgadinhos'},
        {'id': 'oleaginosa',       'label': 'Oleaginosa (bônus)',       'obrigatorio': False, 'dica': 'Castanhas, nozes e amendoim são ótimas opções'},
    ],
    'almoco': [
        {'id': 'cereal_tuberculo', 'label': 'Cereal ou tubérculo',     'obrigatorio': True,  'dica': 'Ex: arroz, mandioca, batata, macarrão'},
        {'id': 'leguminosa',       'label': 'Leguminosa',               'obrigatorio': True,  'dica': 'Ex: feijão, lentilha, grão-de-bico, ervilha'},
        {'id': 'legume_verdura',   'label': 'Legumes e/ou verduras',    'obrigatorio': True,  'dica': 'Presentes em todos os almoços do Guia'},
        {'id': 'proteina',         'label': 'Proteína (opcional)',       'obrigatorio': False, 'dica': 'Prefira ovo, peixe ou frango a carne vermelha'},
        {'id': 'sem_ultraprocessado', 'label': 'Sem ultraprocessados',  'obrigatorio': True,  'dica': 'Evite embutidos, temperos prontos e molhos industriais'},
    ],
    'jantar': [
        {'id': 'cereal_tuberculo', 'label': 'Cereal ou tubérculo',     'obrigatorio': True,  'dica': 'Ex: arroz, mandioca, batata, macarrão'},
        {'id': 'leguminosa',       'label': 'Leguminosa',               'obrigatorio': True,  'dica': 'Ex: feijão, lentilha, grão-de-bico'},
        {'id': 'legume_verdura',   'label': 'Legumes e/ou verduras',    'obrigatorio': True,  'dica': 'Verduras e legumes são essenciais'},
        {'id': 'proteina',         'label': 'Proteína (opcional)',       'obrigatorio': False, 'dica': 'Prefira preparações leves à noite'},
        {'id': 'sem_ultraprocessado', 'label': 'Sem ultraprocessados',  'obrigatorio': True,  'dica': 'Evite embutidos e produtos industrializados'},
    ],
}


def _analisar_refeicao(tipo: str, itens_alimentos) -> dict:
    """Gera o checklist qualitativo baseado no Guia Alimentar."""
    checklist_def = CHECKLISTS.get(tipo, CHECKLISTS['almoco'])
    categorias_presentes = {al.categoria_guia for al in itens_alimentos}
    tem_ultra = 'ultraprocessado' in categorias_presentes

    resultado_checklist = []
    obrigatorios_ok = 0
    obrigatorios_total = 0

    for criterio in checklist_def:
        cid = criterio['id']
        if cid == 'sem_ultraprocessado':
            cumprido = not tem_ultra
        else:
            cumprido = cid in categorias_presentes

        if criterio['obrigatorio']:
            obrigatorios_total += 1
            if cumprido:
                obrigatorios_ok += 1

        resultado_checklist.append({
            'id': cid,
            'label': criterio['label'],
            'obrigatorio': criterio['obrigatorio'],
            'dica': criterio['dica'],
            'cumprido': cumprido,
        })

    if obrigatorios_total == 0:
        classificacao = 'adequada'
        mensagem = 'Refeição sem critérios definidos.'
    elif obrigatorios_ok == obrigatorios_total and not tem_ultra:
        classificacao = 'adequada'
        mensagem = 'Ótimo! Refeição alinhada ao Guia Alimentar.'
    elif obrigatorios_ok >= obrigatorios_total - 1 and not tem_ultra:
        classificacao = 'parcial'
        mensagem = 'Bom! Falta pouco para completar as recomendações do Guia.'
    else:
        classificacao = 'inadequada'
        if tem_ultra:
            mensagem = 'Atenção! Há ultraprocessados nesta refeição.'
        else:
            mensagem = 'Atenção! Critérios importantes do Guia não foram atendidos.'

    return {
        'classificacao': classificacao,
        'mensagem': mensagem,
        'checklist': resultado_checklist,
        'obrigatorios_cumpridos': obrigatorios_ok,
        'obrigatorios_total': obrigatorios_total,
    }


def _serializar_refeicao(refeicao: Refeicao, incluir_itens=False) -> dict:
    data = {
        'id': refeicao.id,
        'nome_refeicao': refeicao.nome_refeicao,
        'tipo_refeicao': refeicao.tipo_refeicao,
        'data_criacao': refeicao.data_criacao.isoformat() if refeicao.data_criacao else None,
        'total_itens': len(refeicao.itens),
    }
    if incluir_itens:
        itens_alimentos = []
        itens_serializados = []
        for item in refeicao.itens:
            al = item.alimento
            if not al:
                continue
            itens_alimentos.append(al)
            itens_serializados.append({
                'alimento_id': al.id,
                'nome': al.nome,
                'grupo': al.grupo,
                'classificacao_guia': al.classificacao_guia,
                'categoria_guia': al.categoria_guia,
                'sazonalidade_atual': al.sazonalidade_atual,
            })
        data['itens'] = itens_serializados
        data['analise'] = _analisar_refeicao(refeicao.tipo_refeicao, itens_alimentos)
    return data


def _query_refeicao_completa():
    """Query base de Refeicao com eager loading de itens, alimentos e safras."""
    return Refeicao.query.options(
        joinedload(Refeicao.itens)
        .joinedload(ItensRefeicao.alimento)
        .joinedload(Alimento.safras)
    )


@refeicoes_bp.route('', methods=['GET'])
@jwt_required()
def listar_refeicoes():
    usuario_id = int(get_jwt_identity())
    refeicoes = _query_refeicao_completa().filter_by(usuario_id=usuario_id) \
        .order_by(Refeicao.data_criacao.desc()).all()
    return jsonify([_serializar_refeicao(r, incluir_itens=True) for r in refeicoes])


@refeicoes_bp.route('', methods=['POST'])
@jwt_required()
def criar_refeicao():
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}
    nome = data.get('nome_refeicao', '').strip()
    tipo = data.get('tipo_refeicao', 'almoco')

    if not nome:
        return jsonify({'error': 'O campo nome_refeicao é obrigatório'}), 400
    if tipo not in TIPOS_VALIDOS:
        return jsonify({'error': f'tipo_refeicao inválido. Use: {", ".join(TIPOS_VALIDOS)}'}), 400

    refeicao = Refeicao(usuario_id=usuario_id, nome_refeicao=nome, tipo_refeicao=tipo)
    db.session.add(refeicao)
    db.session.commit()

    refeicao = _query_refeicao_completa().filter_by(id=refeicao.id).first()
    return jsonify(_serializar_refeicao(refeicao, incluir_itens=True)), 201


@refeicoes_bp.route('/<int:refeicao_id>', methods=['GET'])
@jwt_required()
def obter_refeicao(refeicao_id):
    usuario_id = int(get_jwt_identity())
    refeicao = _query_refeicao_completa().filter_by(id=refeicao_id, usuario_id=usuario_id).first()
    if not refeicao:
        return jsonify({'error': 'Refeição não encontrada'}), 404
    return jsonify(_serializar_refeicao(refeicao, incluir_itens=True))


@refeicoes_bp.route('/<int:refeicao_id>', methods=['DELETE'])
@jwt_required()
def deletar_refeicao(refeicao_id):
    usuario_id = int(get_jwt_identity())
    refeicao = Refeicao.query.filter_by(id=refeicao_id, usuario_id=usuario_id).first()
    if not refeicao:
        return jsonify({'error': 'Refeição não encontrada'}), 404
    db.session.delete(refeicao)
    db.session.commit()
    return jsonify({'message': 'Refeição excluída com sucesso'})


@refeicoes_bp.route('/<int:refeicao_id>/itens', methods=['POST'])
@jwt_required()
def adicionar_item(refeicao_id):
    usuario_id = int(get_jwt_identity())
    refeicao = Refeicao.query.filter_by(id=refeicao_id, usuario_id=usuario_id).first()
    if not refeicao:
        return jsonify({'error': 'Refeição não encontrada'}), 404

    data = request.get_json() or {}
    alimento_id = data.get('alimento_id')
    if not alimento_id:
        return jsonify({'error': 'O campo alimento_id é obrigatório'}), 400

    alimento = db.session.get(Alimento, alimento_id)
    if not alimento:
        return jsonify({'error': 'Alimento não encontrado'}), 404

    existente = ItensRefeicao.query.filter_by(
        refeicao_id=refeicao_id, alimento_id=alimento_id
    ).first()
    if not existente:
        db.session.add(ItensRefeicao(refeicao_id=refeicao_id, alimento_id=alimento_id))
        db.session.commit()
        db.session.expire(refeicao)

    refeicao = _query_refeicao_completa().filter_by(id=refeicao_id).first()
    return jsonify(_serializar_refeicao(refeicao, incluir_itens=True))


@refeicoes_bp.route('/<int:refeicao_id>/itens/<int:alimento_id>', methods=['DELETE'])
@jwt_required()
def remover_item(refeicao_id, alimento_id):
    usuario_id = int(get_jwt_identity())
    refeicao = Refeicao.query.filter_by(id=refeicao_id, usuario_id=usuario_id).first()
    if not refeicao:
        return jsonify({'error': 'Refeição não encontrada'}), 404

    item = ItensRefeicao.query.filter_by(
        refeicao_id=refeicao_id, alimento_id=alimento_id
    ).first()
    if not item:
        return jsonify({'error': 'Item não encontrado na refeição'}), 404

    db.session.delete(item)
    db.session.commit()
    db.session.expire(refeicao)

    refeicao = _query_refeicao_completa().filter_by(id=refeicao_id).first()
    return jsonify(_serializar_refeicao(refeicao, incluir_itens=True))
