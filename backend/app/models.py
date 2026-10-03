from datetime import datetime, timedelta, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# O Brasil não tem horário de verão desde 2019; o offset fixo evita depender de tzdata na imagem.
FUSO_BRASILIA = timezone(timedelta(hours=-3))


def mes_atual() -> int:
    """Mês corrente no horário de Brasília (o servidor roda em UTC)."""
    return datetime.now(FUSO_BRASILIA).month


# Produtos do CSV da CEAGESP cujo grupo comercial não corresponde ao grupo alimentar do Guia.
CATEGORIA_GUIA_POR_NOME = {
    'BATATA': 'cereal_tuberculo',
    'BATATA-DOCE': 'cereal_tuberculo',
    'CARÁ': 'cereal_tuberculo',
    'INHAME': 'cereal_tuberculo',
    'MANDIOCA': 'cereal_tuberculo',
    'MANDIOQUINHA': 'cereal_tuberculo',
    'MILHO VERDE': 'cereal_tuberculo',
    'MILHO DE PIPOCA': 'cereal_tuberculo',
    'ERVILHA': 'leguminosa',
    'FEIJÃO-DE-CORDA': 'leguminosa',
    'AMENDOIM': 'oleaginosa',
    'AMÊNDOA': 'oleaginosa',
    'AVELÃ': 'oleaginosa',
    'CASTANHA': 'oleaginosa',
    'NOZES': 'oleaginosa',
    'OVOS': 'proteina',
}

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

    __table_args__ = (
        db.UniqueConstraint('codigo_barras', name='uq_alimentos_codigo_barras'),
    )

    @property
    def sazonalidade_atual(self) -> dict | None:
        """Retorna o dado de sazonalidade do mês atual, se existir."""
        mes = mes_atual()
        for safra in self.safras:
            if safra.mes == mes:
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
        por_nome = CATEGORIA_GUIA_POR_NOME.get((self.nome or '').strip().upper())
        if por_nome:
            return por_nome
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
