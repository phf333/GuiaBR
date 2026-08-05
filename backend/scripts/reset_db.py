"""
reset_db.py
-----------
Limpa as tabelas de alimentos e sazonalidade e repopula o banco do zero,
na ordem correta:
  1. seed.py       — hortifrutigranjeiros do CSV (FRUTAS, VERDURAS, LEGUMES,
                     PESCADOS, DIVERSOS) com dados de sazonalidade mensal.
  2. seed_basicos  — demais alimentos do Guia Alimentar (cereais, carnes,
                     laticínios, ultraprocessados, etc.)

O que NÃO é apagado:
  - Tabela usuarios  (preserva contas de usuário)
  - Tabela refeicoes / itens_refeicao  (preserva histórico de refeições)
  - Tabela progresso_capitulos          (preserva progresso de aprendizado)

Execute com:
    python reset_db.py
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app import create_app
from app.models import db

app = create_app()

# ── helpers ──────────────────────────────────────────────────────────────────

def limpar_alimentos():
    """Remove todos os registros de alimentos e sazonalidade (CASCADE)."""
    with app.app_context():
        print("=" * 65)
        print("RESET — Limpando tabelas de alimentos e sazonalidade...")
        print("=" * 65)

        db.session.execute(text("DELETE FROM itens_refeicao"))
        print("[1/3] itens_refeicao limpos.")

        db.session.execute(text("DELETE FROM historico_scanner"))
        print("[2/3] historico_scanner limpo.")

        db.session.execute(text("DELETE FROM sazonalidade"))
        db.session.execute(text("DELETE FROM alimentos"))
        print("[3/3] alimentos e sazonalidade limpos.")

        db.session.commit()
        print("\nTabelas limpas com sucesso!\n")


# ── seed principal (CSV) ──────────────────────────────────────────────────────

def seed_principal():
    """Carrega hortifrutigranjeiros do CSV com dados de sazonalidade.
    Reaproveita a lógica de carregamento de seed.py para não duplicar código."""
    import pandas as pd
    from seed import CSV_PATH, carregar_csv_sazonalidade

    with app.app_context():
        print("=" * 65)
        print("SEED PRINCIPAL — Hortifrutigranjeiros (CSV)")
        print("=" * 65)

        if not os.path.exists(CSV_PATH):
            print(f"[ERRO] CSV não encontrado: {CSV_PATH}")
            return

        df = pd.read_csv(CSV_PATH)
        print(f"Lendo {len(df)} produtos de: {CSV_PATH}\n")

        carregar_csv_sazonalidade(df)
        print(f"\n[OK] {len(df)} alimentos e {len(df) * 12} safras mensais inseridos.")


# ── seed_basicos ──────────────────────────────────────────────────────────────

def seed_basicos():
    """Carrega alimentos básicos do Guia Alimentar (sem sazonalidade)."""
    from seed_basicos import seed_basicos as _seed
    _seed()


# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("  RESET COMPLETO DO BANCO DE DADOS")
    print("  Usuários, refeições e progresso serão PRESERVADOS.")
    print("=" * 65 + "\n")

    confirmacao = input("Confirma o reset? [s/N]: ").strip().lower()
    if confirmacao != "s":
        print("Operação cancelada.")
        exit(0)

    print()
    limpar_alimentos()
    seed_principal()
    print()
    seed_basicos()

    print("\n" + "=" * 65)
    print("  BANCO REPOPULADO COM SUCESSO!")
    print("=" * 65)
