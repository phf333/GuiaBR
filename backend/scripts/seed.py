"""
seed.py
-------
Cria ou atualiza as tabelas (migrações) e carrega os alimentos de referência do app, a partir
de dois CSVs em data/:

  1. sazonalidade_consolidada_produtos.csv — hortifrutigranjeiros e pescados da CEAGESP,
     com a safra de cada mês. Gerado por xlsx_to_csv.py. Entram como 'in natura'.
  2. alimentos_basicos.csv — demais alimentos do Guia Alimentar para a População Brasileira
     (2ª edição, 2014, cap. 2–4): leguminosas, cereais, tubérculos, laticínios, carnes e ovos,
     oleaginosas, ingredientes culinários, processados e ultraprocessados, classificados
     pelo sistema NOVA. Sem sazonalidade.

Uso:
    python scripts/seed.py           # carga inicial; seguro rodar de novo
    python scripts/seed.py --reset   # apaga e recarrega os alimentos (pede confirmação)

Rodar de novo não duplica nada: a sazonalidade só é carregada se ainda não houver alimentos
de referência, e os básicos são atualizados pelo nome.

--reset preserva usuários, refeições (que ficam vazias) e progresso dos capítulos, mas apaga
os itens das refeições e o histórico do scanner, porque os ids dos alimentos mudam na recarga.
"""

import argparse
import csv
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask_migrate import upgrade
from sqlalchemy import inspect, text
from app import create_app
from app.models import db, Alimento, Sazonalidade

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
CSV_SAZONALIDADE = os.path.join(DATA_DIR, 'sazonalidade_consolidada_produtos.csv')
CSV_BASICOS = os.path.join(DATA_DIR, 'alimentos_basicos.csv')

MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

SAFRA_POR_TEXTO = {
    'Sem Volume': 0,
    'Safra Muito Baixa': 1,
    'Safra Baixa/Média': 2,
    'Safra Média/Alta': 3,
    'Safra Alta': 4,
}


def ler_csv(caminho):
    # utf-8-sig: o CSV de sazonalidade é gravado com BOM
    with open(caminho, encoding='utf-8-sig', newline='') as arquivo:
        return list(csv.DictReader(arquivo))


def alimentos_de_referencia():
    """Alimentos do Guia; os que têm código de barras vieram do scanner e não são tocados pelo seed."""
    return Alimento.query.filter(Alimento.codigo_barras.is_(None))


def carregar_sazonalidade():
    """Cria um Alimento por produto da CEAGESP, com a safra dos 12 meses."""
    if alimentos_de_referencia().first() is not None:
        print("Alimentos de referência já cadastrados; pulando a carga de sazonalidade.")
        return

    linhas = ler_csv(CSV_SAZONALIDADE)
    for linha in linhas:
        alimento = Alimento(nome=linha['Produto'], grupo=linha['Grupo'], classificacao_guia='in natura')
        alimento.safras = [
            Sazonalidade(mes=numero, safra_atual=SAFRA_POR_TEXTO.get(linha[mes], 0))
            for numero, mes in enumerate(MESES, start=1)
        ]
        db.session.add(alimento)

    db.session.commit()
    print(f"Sazonalidade: {len(linhas)} alimentos e {len(linhas) * len(MESES)} safras mensais cadastrados.")


def carregar_basicos():
    """Insere os alimentos básicos; os que já existem pelo nome têm grupo e classificação atualizados."""
    existentes = {alimento.nome.lower(): alimento for alimento in alimentos_de_referencia()}
    inseridos = atualizados = 0

    for linha in ler_csv(CSV_BASICOS):
        alimento = existentes.get(linha['Produto'].lower())
        if alimento:
            atualizados += 1
        else:
            alimento = Alimento()
            db.session.add(alimento)
            existentes[linha['Produto'].lower()] = alimento
            inseridos += 1
        alimento.nome = linha['Produto']
        alimento.grupo = linha['Grupo']
        alimento.classificacao_guia = linha['Classificacao']

    db.session.commit()
    print(f"Básicos: {inseridos} alimentos inseridos, {atualizados} atualizados.")


def limpar_alimentos():
    """Apaga os alimentos e tudo que aponta para eles."""
    for tabela in ('itens_refeicao', 'historico_scanner', 'sazonalidade', 'alimentos'):
        db.session.execute(text(f"DELETE FROM {tabela}"))
    db.session.commit()
    print("Alimentos, sazonalidade, itens de refeição e histórico do scanner apagados.")


def preparar_schema():
    """Cria ou atualiza as tabelas pelas migrações (o mesmo que `flask db upgrade`)."""
    inspetor = inspect(db.engine)
    if inspetor.has_table('alimentos') and not inspetor.has_table('alembic_version'):
        sys.exit(
            "Erro: este banco foi criado antes das migrações.\n"
            "Rode uma vez `python -m flask db stamp 0001` e depois o seed de novo "
            "(veja a seção de migrações no README)."
        )
    upgrade(directory=os.path.join(os.path.dirname(__file__), '..', 'migrations'))


def seed(reset=False):
    for caminho in (CSV_SAZONALIDADE, CSV_BASICOS):
        if not os.path.exists(caminho):
            sys.exit(f"Erro: arquivo não encontrado: {caminho}")

    with create_app().app_context():
        preparar_schema()
        if reset:
            limpar_alimentos()
        carregar_sazonalidade()
        carregar_basicos()
        print(f"Total de alimentos de referência: {alimentos_de_referencia().count()}.")


def confirmar_reset() -> bool:
    print("RESET: usuários e progresso serão PRESERVADOS.")
    print("       Itens das refeições e histórico do scanner serão APAGADOS.")
    return input("Confirma o reset? [s/N]: ").strip().lower() == "s"


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Cria as tabelas e carrega os alimentos de referência.")
    parser.add_argument('--reset', action='store_true', help="apaga e recarrega os alimentos (pede confirmação)")
    args = parser.parse_args()

    if args.reset and not confirmar_reset():
        sys.exit("Operação cancelada.")

    seed(reset=args.reset)
