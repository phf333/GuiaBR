from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, ProgressoCapitulo, Usuario

capitulos_bp = Blueprint('capitulos', __name__)

CAPITULOS_NUMEROS = [1, 2, 3, 4, 5, 6]
STATUS_INICIAL_CAPITULO = 'active'


def obter_ou_criar_progresso(usuario_id):
    """Retorna {numero: status} para todos os capítulos conhecidos."""
    user = db.session.get(Usuario, usuario_id)
    if not user:
        return None

    progresso_list = ProgressoCapitulo.query.filter_by(usuario_id=usuario_id).all()
    numeros_existentes = {p.capitulo_numero for p in progresso_list}

    novos = []
    for numero in CAPITULOS_NUMEROS:
        if numero not in numeros_existentes:
            p = ProgressoCapitulo(
                usuario_id=usuario_id,
                capitulo_numero=numero,
                status=STATUS_INICIAL_CAPITULO
            )
            db.session.add(p)
            novos.append(p)

    if novos:
        db.session.commit()
        progresso_list = progresso_list + novos

    return {p.capitulo_numero: p.status for p in progresso_list}


def _montar_resposta(progresso_map: dict) -> list:
    return [
        {'numero': num, 'status': progresso_map.get(num, 'active')}
        for num in CAPITULOS_NUMEROS
    ]


@capitulos_bp.route('', methods=['GET'])
@jwt_required()
def get_capitulos():
    usuario_id = int(get_jwt_identity())
    progresso_map = obter_ou_criar_progresso(usuario_id)
    if progresso_map is None:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    return jsonify(_montar_resposta(progresso_map))


@capitulos_bp.route('/<int:numero>/concluir', methods=['POST'])
@jwt_required()
def concluir_capitulo(numero):
    usuario_id = int(get_jwt_identity())
    progresso_map = obter_ou_criar_progresso(usuario_id)
    if progresso_map is None:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    progresso_atual = ProgressoCapitulo.query.filter_by(
        usuario_id=usuario_id, capitulo_numero=numero
    ).first()
    if progresso_atual and progresso_atual.status != 'done':
        progresso_atual.status = 'done'
        db.session.add(progresso_atual)

    db.session.commit()

    progresso_list = ProgressoCapitulo.query.filter_by(usuario_id=usuario_id).all()
    progresso_map = {p.capitulo_numero: p.status for p in progresso_list}
    return jsonify(_montar_resposta(progresso_map))


@capitulos_bp.route('/reset', methods=['POST'])
@jwt_required()
def resetar_progresso():
    usuario_id = int(get_jwt_identity())
    user = db.session.get(Usuario, usuario_id)
    if not user:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    ProgressoCapitulo.query.filter_by(usuario_id=usuario_id).delete()
    db.session.commit()

    progresso_map = obter_ou_criar_progresso(usuario_id)
    return jsonify(_montar_resposta(progresso_map))

