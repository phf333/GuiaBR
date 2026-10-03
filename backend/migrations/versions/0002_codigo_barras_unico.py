"""codigo de barras unico

Dois scans simultâneos do mesmo produto podiam criar dois alimentos com o mesmo código
de barras. Unifica os que existirem e impede novos.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-03 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

NOME_CONSTRAINT = 'uq_alimentos_codigo_barras'


def _constraint_existente(conn):
    """Nome da constraint única sobre codigo_barras, se o banco já tiver uma.
    Bancos criados por db.create_all() depois que o modelo ganhou unique=True já a têm."""
    for constraint in sa.inspect(conn).get_unique_constraints('alimentos'):
        if constraint['column_names'] == ['codigo_barras']:
            return constraint['name']
    return None


def _unificar_duplicados(conn):
    duplicados = conn.execute(sa.text(
        "SELECT codigo_barras, MIN(id) FROM alimentos "
        "WHERE codigo_barras IS NOT NULL GROUP BY codigo_barras HAVING COUNT(*) > 1"
    )).fetchall()

    for codigo, manter in duplicados:
        sobrando = conn.execute(
            sa.text("SELECT id FROM alimentos WHERE codigo_barras = :codigo AND id <> :manter"),
            {'codigo': codigo, 'manter': manter},
        ).scalars().all()

        for antigo in sobrando:
            ids = {'antigo': antigo, 'manter': manter}
            # A chave de itens_refeicao é (refeicao, alimento): remove o que colidiria ao reapontar.
            conn.execute(sa.text(
                "DELETE FROM itens_refeicao WHERE alimento_id = :antigo AND refeicao_id IN "
                "(SELECT refeicao_id FROM itens_refeicao WHERE alimento_id = :manter)"
            ), ids)
            conn.execute(sa.text("UPDATE itens_refeicao SET alimento_id = :manter WHERE alimento_id = :antigo"), ids)
            conn.execute(sa.text("UPDATE historico_scanner SET alimento_id = :manter WHERE alimento_id = :antigo"), ids)
            conn.execute(sa.text("DELETE FROM sazonalidade WHERE alimento_id = :antigo"), ids)
            conn.execute(sa.text("DELETE FROM alimentos WHERE id = :antigo"), ids)

        # O app mantém uma entrada de histórico por usuário e alimento; fica a mais recente.
        conn.execute(sa.text(
            "DELETE FROM historico_scanner WHERE alimento_id = :manter AND id NOT IN "
            "(SELECT MAX(id) FROM historico_scanner WHERE alimento_id = :manter GROUP BY usuario_id)"
        ), {'manter': manter})


def upgrade():
    conn = op.get_bind()
    existente = _constraint_existente(conn)
    if existente == NOME_CONSTRAINT:
        return

    with op.batch_alter_table('alimentos') as batch_op:
        if existente:
            # Já é única, mas com o nome automático do banco: recria com o nome usado no modelo.
            batch_op.drop_constraint(existente, type_='unique')
        else:
            _unificar_duplicados(conn)
        batch_op.create_unique_constraint(NOME_CONSTRAINT, ['codigo_barras'])


def downgrade():
    nome = _constraint_existente(op.get_bind())
    if nome:
        with op.batch_alter_table('alimentos') as batch_op:
            batch_op.drop_constraint(nome, type_='unique')
