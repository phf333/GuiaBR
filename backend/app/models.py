from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)  
    data_cadastro = db.Column(db.DateTime, default=db.func.current_timestamp())

    progresso = db.relationship('ProgressoCapitulo', backref='usuario', cascade='all, delete-orphan')
    historico = db.relationship('HistoricoScanner', backref='usuario', cascade='all, delete-orphan')
    refeicoes = db.relationship('Refeicao', backref='usuario', cascade='all, delete-orphan')

    def set_senha(self, senha: str):
        self.senha_hash = generate_password_hash(senha)

    def check_senha(self, senha: str) -> bool:
        if not self.senha_hash:
            return False
        return check_password_hash(self.senha_hash, senha)

class Alimento(db.Model):
    __tablename__ = 'alimentos'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    grupo = db.Column(db.String(50))
    classificacao_guia = db.Column(db.String(50), default='indisponivel')
    codigo_barras = db.Column(db.String(50), nullable=True)
    dados_completos = db.Column(db.JSON, nullable=True)

    safras = db.relationship('Sazonalidade', backref='alimento', cascade='all, delete-orphan')

    @property
    def sazonalidade_atual(self) -> dict | None:
        """Retorna o dado de sazonalidade do mês atual, se existir."""
        from datetime import datetime
        mes_atual = datetime.now().month
        for safra in self.safras:
            if safra.mes == mes_atual:
                valor = safra.safra_atual
                nivel = 'alta' if valor == 4 else ('media' if valor >= 2 else ('baixa' if valor == 1 else 'fora'))
                mapa_safra_texto = {
                    0: 'Sem Volume',
                    1: 'Safra Muito Baixa',
                    2: 'Safra Baixa/Média',
                    3: 'Safra Média/Alta',
                    4: 'Safra Alta'
                }
                return {
                    'valor': valor,
                    'texto': mapa_safra_texto.get(valor, 'Sem Volume'),
                    'nivel': nivel
                }
        return None

    @property
    def categoria_guia(self) -> str:
        """Mapeia o grupo do banco para a categoria do Guia Alimentar."""
        grupo = (self.grupo or '').upper()
        classe = (self.classificacao_guia or '').lower()
        if classe == 'ultraprocessado':
            return 'ultraprocessado'
        if grupo == 'FRUTAS':
            return 'fruta'
        if grupo in {'CEREAIS', 'TUBERCULOS'}:
            return 'cereal_tuberculo'
        if grupo == 'LEGUMINOSAS':
            return 'leguminosa'
        if grupo in {'LEGUMES', 'VERDURAS'}:
            return 'legume_verdura'
        if grupo in {'CARNES', 'PESCADOS'}:
            return 'proteina'
        if grupo == 'LATICINIOS':
            return 'laticinios'
        if grupo == 'OLEAGINOSAS':
            return 'oleaginosa'
        return 'outro'

class Sazonalidade(db.Model):
    __tablename__ = 'sazonalidade'
    id = db.Column(db.Integer, primary_key=True)
    alimento_id = db.Column(db.Integer, db.ForeignKey('alimentos.id', ondelete='CASCADE'), nullable=False)
    mes = db.Column(db.Integer, nullable=False)
    safra_atual = db.Column(db.Integer)

    __table_args__ = (
        db.UniqueConstraint('alimento_id', 'mes', name='uq_alimento_mes'),
        db.CheckConstraint('mes >= 1 AND mes <= 12', name='check_mes_range'),
    )

class HistoricoScanner(db.Model):
    __tablename__ = 'historico_scanner'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False)
    alimento_id = db.Column(db.Integer, db.ForeignKey('alimentos.id', ondelete='CASCADE'))
    data_consulta = db.Column(db.DateTime, default=db.func.current_timestamp())

    alimento = db.relationship('Alimento', backref='historicos')

class Refeicao(db.Model):
    __tablename__ = 'refeicoes'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False)
    nome_refeicao = db.Column(db.String(100), nullable=False)
    # Tipo: 'cafe_manha' | 'lanche' | 'almoco' | 'jantar'
    tipo_refeicao = db.Column(db.String(20), nullable=False, default='almoco')
    data_criacao = db.Column(db.DateTime, default=db.func.current_timestamp())

    itens = db.relationship('ItensRefeicao', backref='refeicao', cascade='all, delete-orphan')

class ItensRefeicao(db.Model):
    __tablename__ = 'itens_refeicao'
    refeicao_id = db.Column(db.Integer, db.ForeignKey('refeicoes.id', ondelete='CASCADE'), primary_key=True)
    alimento_id = db.Column(db.Integer, db.ForeignKey('alimentos.id', ondelete='CASCADE'), primary_key=True)

    alimento = db.relationship('Alimento')

class ProgressoCapitulo(db.Model):
    __tablename__ = 'progresso_capitulos'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False)
    capitulo_numero = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active') 
    data_atualizacao = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    __table_args__ = (
        db.UniqueConstraint('usuario_id', 'capitulo_numero', name='uq_usuario_capitulo'),
    )
