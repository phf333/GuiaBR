from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from app.models import db, ProgressoCapitulo, Usuario

capitulos_bp = Blueprint('capitulos', __name__)

CAPITULOS_NUMEROS = [1, 2, 3, 4, 5, 6]
STATUS_INICIAL_CAPITULO = 'active'
# O backend não conhece o conteúdo dos capítulos; o limite só barra valores absurdos.
ULTIMO_CARD_MAXIMO = 999


def _progresso(usuario_id: int) -> list:
    """Status e último card lido de todos os capítulos. Capítulo sem linha no banco está no estado inicial."""
    linhas = {
        p.capitulo_numero: p
        for p in ProgressoCapitulo.query.filter_by(usuario_id=usuario_id)
    }
    return [
        {
            'numero': numero,
            'status': linhas[numero].status if numero in linhas else STATUS_INICIAL_CAPITULO,
            'ultimo_card': linhas[numero].ultimo_card if numero in linhas else 0,
        }
        for numero in CAPITULOS_NUMEROS
    ]


def _atualizar(usuario_id: int, numero: int, **campos):
    """Altera a linha de progresso do capítulo, criando-a se ainda não existir."""
    progresso = ProgressoCapitulo.query.filter_by(
        usuario_id=usuario_id, capitulo_numero=numero
    ).first()
    if not progresso:
        progresso = ProgressoCapitulo(usuario_id=usuario_id, capitulo_numero=numero)
        db.session.add(progresso)
    for campo, valor in campos.items():
        setattr(progresso, campo, valor)

    try:
        db.session.commit()
    except IntegrityError:
        # Outra requisição criou a linha do mesmo capítulo ao mesmo tempo: aplica sobre ela.
        db.session.rollback()
        ProgressoCapitulo.query.filter_by(
            usuario_id=usuario_id, capitulo_numero=numero
        ).update(campos)
        db.session.commit()


def _erro_de_acesso(usuario_id: int, numero: int = None):
    """Resposta 404 quando o usuário do token ou o capítulo não existem; None se está tudo certo."""
    if not db.session.get(Usuario, usuario_id):
        return jsonify({'error': 'Usuário não encontrado'}), 404
    if numero is not None and numero not in CAPITULOS_NUMEROS:
        return jsonify({'error': 'Capítulo não encontrado'}), 404
    return None


@capitulos_bp.route('', methods=['GET'])
@jwt_required()
def get_capitulos():
    usuario_id = int(get_jwt_identity())
    erro = _erro_de_acesso(usuario_id)
    if erro:
        return erro

    return jsonify(_progresso(usuario_id))


@capitulos_bp.route('/<int:numero>/concluir', methods=['POST'])
@jwt_required()
def concluir_capitulo(numero):
    usuario_id = int(get_jwt_identity())
    erro = _erro_de_acesso(usuario_id, numero)
    if erro:
        return erro

    _atualizar(usuario_id, numero, status='done')
    return jsonify(_progresso(usuario_id))


@capitulos_bp.route('/<int:numero>/posicao', methods=['POST'])
@jwt_required()
def salvar_posicao(numero):
    """Registra o card em que o usuário parou no capítulo."""
    usuario_id = int(get_jwt_identity())
    erro = _erro_de_acesso(usuario_id, numero)
    if erro:
        return erro

    ultimo_card = (request.get_json(silent=True) or {}).get('ultimo_card')
    # bool é subclasse de int em Python; True/False não são posições válidas.
    if type(ultimo_card) is not int or not 0 <= ultimo_card <= ULTIMO_CARD_MAXIMO:
        return jsonify({'error': f'ultimo_card deve ser um inteiro entre 0 e {ULTIMO_CARD_MAXIMO}'}), 400

    _atualizar(usuario_id, numero, ultimo_card=ultimo_card)
    return jsonify(_progresso(usuario_id))


@capitulos_bp.route('/reset', methods=['POST'])
@jwt_required()
def resetar_progresso():
    usuario_id = int(get_jwt_identity())
    erro = _erro_de_acesso(usuario_id)
    if erro:
        return erro

    ProgressoCapitulo.query.filter_by(usuario_id=usuario_id).delete()
    db.session.commit()

    return jsonify(_progresso(usuario_id))
