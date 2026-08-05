from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, Usuario

auth_bp = Blueprint('auth', __name__)


def _serializar_usuario(usuario: Usuario) -> dict:
    return {
        'id': usuario.id,
        'nome': usuario.nome,
        'email': usuario.email,
    }


@auth_bp.route('/register', methods=['POST'])
def register():
    """Cadastra um novo usuário."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Dados inválidos'}), 400

    nome = data.get('nome', '').strip()
    email = data.get('email', '').strip().lower()
    senha = data.get('senha', '')

    if not nome or not email or not senha:
        return jsonify({'error': 'Nome, email e senha são obrigatórios'}), 400

    if len(senha) < 6:
        return jsonify({'error': 'A senha deve ter pelo menos 6 caracteres'}), 400

    if Usuario.query.filter_by(email=email).first():
        return jsonify({'error': 'Este e-mail já está cadastrado'}), 409

    novo_usuario = Usuario(nome=nome, email=email)
    novo_usuario.set_senha(senha)
    db.session.add(novo_usuario)
    db.session.commit()

    token = create_access_token(identity=str(novo_usuario.id))
    return jsonify({
        'access_token': token,
        'usuario': _serializar_usuario(novo_usuario)
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Autentica um usuário e retorna um token JWT."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Dados inválidos'}), 400

    email = data.get('email', '').strip().lower()
    senha = data.get('senha', '')

    if not email or not senha:
        return jsonify({'error': 'E-mail e senha são obrigatórios'}), 400

    usuario = Usuario.query.filter_by(email=email).first()
    if not usuario or not usuario.check_senha(senha):
        return jsonify({'error': 'E-mail ou senha incorretos'}), 401

    token = create_access_token(identity=str(usuario.id))
    return jsonify({
        'access_token': token,
        'usuario': _serializar_usuario(usuario)
    })


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """Retorna os dados do usuário autenticado."""
    usuario_id = int(get_jwt_identity())
    usuario = db.session.get(Usuario, usuario_id)
    if not usuario:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    return jsonify({
        **_serializar_usuario(usuario),
        'data_cadastro': usuario.data_cadastro.isoformat() if usuario.data_cadastro else None,
    })
