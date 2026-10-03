from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from app.models import db, ProgressoCapitulo, Usuario

capitulos_bp = Blueprint('capitulos', __name__)

CAPITULOS_NUMEROS = [1, 2, 3, 4, 5, 6]
STATUS_INICIAL_CAPITULO = 'active'


def _progresso(usuario_id: int) -> list:
    """Status de todos os capítulos. Só os concluídos têm linha no banco; os demais estão no status inicial."""
    concluidos = {
        p.capitulo_numero
        for p in ProgressoCapitulo.query.filter_by(usuario_id=usuario_id, status='done')
    }
    return [
        {'numero': numero, 'status': 'done' if numero in concluidos else STATUS_INICIAL_CAPITULO}
        for numero in CAPITULOS_NUMEROS
    ]


def _usuario_nao_encontrado():
    return jsonify({'error': 'Usuário não encontrado'}), 404


@capitulos_bp.route('', methods=['GET'])
@jwt_required()
def get_capitulos():
    usuario_id = int(get_jwt_identity())
    if not db.session.get(Usuario, usuario_id):
        return _usuario_nao_encontrado()

    return jsonify(_progresso(usuario_id))


@capitulos_bp.route('/<int:numero>/concluir', methods=['POST'])
@jwt_required()
def concluir_capitulo(numero):
    usuario_id = int(get_jwt_identity())
    if not db.session.get(Usuario, usuario_id):
        return _usuario_nao_encontrado()
    if numero not in CAPITULOS_NUMEROS:
        return jsonify({'error': 'Capítulo não encontrado'}), 404

    progresso = ProgressoCapitulo.query.filter_by(
        usuario_id=usuario_id, capitulo_numero=numero
    ).first()
    if progresso:
        progresso.status = 'done'
    else:
        db.session.add(ProgressoCapitulo(usuario_id=usuario_id, capitulo_numero=numero, status='done'))

    try:
        db.session.commit()
    except IntegrityError:
        # Outra requisição concluiu o mesmo capítulo ao mesmo tempo; o resultado é o mesmo.
        db.session.rollback()

    return jsonify(_progresso(usuario_id))


@capitulos_bp.route('/reset', methods=['POST'])
@jwt_required()
def resetar_progresso():
    usuario_id = int(get_jwt_identity())
    if not db.session.get(Usuario, usuario_id):
        return _usuario_nao_encontrado()

    ProgressoCapitulo.query.filter_by(usuario_id=usuario_id).delete()
    db.session.commit()

    return jsonify(_progresso(usuario_id))
