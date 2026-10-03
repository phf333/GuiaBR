import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pandas as pd
from app import create_app
from app.models import db, Alimento, Sazonalidade

app = create_app()

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'sazonalidade_consolidada_produtos.csv')

MESES_MAP = {
    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
}

def mapear_safra(texto):
    mapeamento = {
        'Sem Volume': 0,
        'Safra Muito Baixa': 1,
        'Safra Baixa/Média': 2,
        'Safra Média/Alta': 3,
        'Safra Alta': 4
    }
    return mapeamento.get(texto, 0)

def carregar_csv_sazonalidade(df):
    """Cria os registros de Alimento + Sazonalidade (12 meses) a partir do
    DataFrame do CSV. Compartilhada entre seed.py e reset_db.py.
    Deve ser chamada dentro de um app_context ativo; faz o commit ao final."""
    for idx, row in df.iterrows():
        alimento = Alimento(
            nome=row['Produto'],
            grupo=row['Grupo'],
            classificacao_guia='in natura'
        )
        db.session.add(alimento)
        db.session.flush() # Gera o ID do alimento para podermos usar nas safras

        # Insere os 12 meses na tabela 'sazonalidade'
        for mes_nome, mes_num in MESES_MAP.items():
            safra_val = row[mes_nome]
            safra_num = mapear_safra(safra_val)

            sazonalidade = Sazonalidade(
                alimento_id=alimento.id,
                mes=mes_num,
                safra_atual=safra_num
            )
            db.session.add(sazonalidade)

        if idx % 50 == 0:
            print(f"Carregados {idx} alimentos...")

    db.session.commit()


def seed_database():
    with app.app_context():
        print("Criando tabelas no PostgreSQL...")
        db.create_all()
        print("Tabelas criadas com sucesso!")

        # Verifica se o banco já está populado com alimentos
        if Alimento.query.first() is not None:
            print("O banco de dados já possui alimentos cadastrados. Pulando carga de seed.")
            return

        if not os.path.exists(CSV_PATH):
            print(f"Erro: Arquivo CSV não encontrado no caminho: {CSV_PATH}")
            return

        print(f"Lendo dados de sazonalidade de: {CSV_PATH}")
        df = pd.read_csv(CSV_PATH)

        print("Iniciando carga de alimentos e safras...")
        carregar_csv_sazonalidade(df)
        print(f"Sucesso! {len(df)} alimentos e {len(df) * 12} safras mensais cadastrados.")

if __name__ == '__main__':
    seed_database()
