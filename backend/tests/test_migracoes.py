import os

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import downgrade, upgrade

from app import create_app
from app.models import db

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'migrations')


@pytest.fixture
def app_migrado(tmp_path):
    """App sobre um SQLite em arquivo, vazio: as tabelas vêm das migrações, não de create_all()."""
    class Config:
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'migracoes.db'}"
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        SECRET_KEY = "test-secret"
        JWT_SECRET_KEY = "test-secret"
        RATELIMIT_ENABLED = False

    flask_app = create_app(Config)
    with flask_app.app_context():
        yield flask_app
        db.session.remove()
        db.engine.dispose()


def _migrar(revisao='head'):
    upgrade(directory=MIGRATIONS_DIR, revision=revisao)


def test_migracoes_produzem_o_schema_dos_modelos(app_migrado):
    _migrar()

    with db.engine.connect() as conn:
        diferencas = compare_metadata(MigrationContext.configure(conn), db.metadata)

    assert diferencas == []


def test_migracoes_podem_ser_desfeitas(app_migrado):
    _migrar()

    downgrade(directory=MIGRATIONS_DIR, revision='base')

    assert sa.inspect(db.engine).get_table_names() == ['alembic_version']


def test_0002_unifica_alimentos_com_o_mesmo_codigo_de_barras(app_migrado):
    _migrar('0001')
    with db.engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO usuarios (id, nome, email, senha_hash) VALUES (1, 'U', 'u@x.com', 'h')"))
        conn.execute(sa.text(
            "INSERT INTO alimentos (id, nome, codigo_barras) VALUES "
            "(1, 'Refri', '789'), (2, 'Refri', '789'), (3, 'Suco', '111'), (4, 'Banana', NULL), (5, 'Maçã', NULL)"
        ))
        conn.execute(sa.text(
            "INSERT INTO historico_scanner (id, usuario_id, alimento_id) VALUES (1, 1, 1), (2, 1, 2), (3, 1, 3)"
        ))

    _migrar()

    with db.engine.connect() as conn:
        alimentos = conn.execute(sa.text("SELECT id FROM alimentos ORDER BY id")).scalars().all()
        historico = conn.execute(sa.text("SELECT id, alimento_id FROM historico_scanner ORDER BY id")).fetchall()

    assert alimentos == [1, 3, 4, 5]
    assert [tuple(h) for h in historico] == [(2, 1), (3, 3)]


def test_0002_impede_novo_codigo_de_barras_repetido(app_migrado):
    _migrar()
    with db.engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO alimentos (nome, codigo_barras) VALUES ('Refri', '789')"))

    with pytest.raises(sa.exc.IntegrityError):
        with db.engine.begin() as conn:
            conn.execute(sa.text("INSERT INTO alimentos (nome, codigo_barras) VALUES ('Outro', '789')"))
