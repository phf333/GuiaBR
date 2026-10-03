"""ultimo card lido por capitulo

Guarda no servidor o card em que o usuário parou em cada capítulo, para a leitura
ser retomada em outro aparelho ou depois do logout.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-03 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('progresso_capitulos') as batch_op:
        batch_op.add_column(sa.Column('ultimo_card', sa.Integer(), server_default='0', nullable=False))


def downgrade():
    with op.batch_alter_table('progresso_capitulos') as batch_op:
        batch_op.drop_column('ultimo_card')
