"""
seed_basicos.py
---------------
Popula o banco com alimentos do Guia Alimentar para a População Brasileira
(Ministério da Saúde, 2ª edição, 2014).

Complementa o seed principal (sazonalidade_consolidada_produtos.csv),
que já contém hortifrutigranjeiros (FRUTAS, VERDURAS, LEGUMES, PESCADOS,
DIVERSOS) com dados de sazonalidade/safra por mês.

Este seed cobre os grupos restantes do Guia:
  – Feijões e leguminosas
  – Cereais e derivados
  – Raízes e tubérculos
  – Leite, queijos e derivados
  – Carnes e ovos (exceto pescados)
  – Oleaginosas (castanhas, nozes, amendoim)
  – Bebidas (café, chá, água de coco)
  – Temperos naturais e especiarias
  – Óleos, gorduras, açúcares e sal (ingredientes culinários)
  – Conservas e processados (Grupo 3 NOVA)
  – Ultraprocessados (Grupo 4 NOVA — critério negativo do checklist)

Referência: Guia Alimentar para a População Brasileira, cap. 2–4.
Classificações seguem o sistema NOVA (Monteiro et al., 2010).

Execute com:
    python seed_basicos.py

É seguro rodar múltiplas vezes — verifica duplicatas pelo nome antes de inserir.
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.models import db, Alimento

app = create_app()

# ---------------------------------------------------------------------------
# Alimentos baseados estritamente no Guia Alimentar para a População
# Brasileira (Ministério da Saúde, 2ª edição, 2014), capítulos 2, 3 e 4.
# Sistema NOVA de classificação: Grupo 1 (in natura / minimamente
# processado), Grupo 2 (ingredientes culinários), Grupo 3 (processados),
# Grupo 4 (ultraprocessados).
# ---------------------------------------------------------------------------
ALIMENTOS_BASICOS = [

    # ── FEIJÕES E LEGUMINOSAS ──────────────────────────────────────────────
    # Guia Cap. 3 — "mistura de feijão com arroz aparece em quase todos os
    # almoços e jantares"; leguminosas como fonte proteica vegetal de
    # excelência. Grãos secos = minimamente processados (secagem e limpeza).
    {"nome": "FEIJÃO PRETO",                "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "FEIJÃO BRANCO",               "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "FEIJÃO MULATINHO",            "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "FEIJÃO CARIOCA",              "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "FEIJÃO FRADINHO",             "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "FEIJÃO-FAVA",                 "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "FEIJÃO-DE-CORDA",             "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "ERVILHA (SECA)",              "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "LENTILHA",                    "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "GRÃO-DE-BICO",                "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},
    {"nome": "SOJA (GRÃO)",                 "grupo": "LEGUMINOSAS", "classificacao_guia": "minimamente processado"},

    # ── CEREAIS E DERIVADOS ────────────────────────────────────────────────
    # Guia Cap. 3 — cereais como base das refeições principais.
    # Derivados (farinha, flocos, massas) = minimamente processados, sem
    # adição de sal/açúcar.
    {"nome": "ARROZ BRANCO",                "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "ARROZ INTEGRAL",              "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "ARROZ PARBOILIZADO",          "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "MILHO (EM GRÃO)",             "grupo": "CEREAIS",     "classificacao_guia": "in natura"},
    {"nome": "MILHO (NA ESPIGA)",           "grupo": "CEREAIS",     "classificacao_guia": "in natura"},
    {"nome": "FARINHA DE MILHO",            "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "CUSCUZ DE MILHO",             "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "FARINHA DE TRIGO",            "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "TRIGO EM GRÃO",               "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "MACARRÃO",                    "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "AVEIA EM FLOCOS",             "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    {"nome": "CENTEIO",                     "grupo": "CEREAIS",     "classificacao_guia": "minimamente processado"},
    # Processados do grupo — pão básico: farinha + água + sal + fermento
    # (Grupo 3). Diferente do pão industrial com aditivos = ultraprocessado.
    {"nome": "PÃO FRANCÊS",                 "grupo": "CEREAIS",     "classificacao_guia": "processado"},
    {"nome": "PÃO INTEGRAL SIMPLES",        "grupo": "CEREAIS",     "classificacao_guia": "processado"},

    # ── RAÍZES E TUBÉRCULOS ────────────────────────────────────────────────
    # Guia Cap. 3 — alternativas ao cereal como base das refeições.
    # Mandioca in natura (raiz fresca); derivados = minimamente processados.
    {"nome": "MANDIOCA (AIPIM)",            "grupo": "TUBERCULOS",  "classificacao_guia": "in natura"},
    {"nome": "FARINHA DE MANDIOCA",         "grupo": "TUBERCULOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "POLVILHO (DOCE/AZEDO)",       "grupo": "TUBERCULOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "TAPIOCA (GOMA)",              "grupo": "TUBERCULOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "BATATA-INGLESA",              "grupo": "TUBERCULOS",  "classificacao_guia": "in natura"},
    {"nome": "BATATA-DOCE",                 "grupo": "TUBERCULOS",  "classificacao_guia": "in natura"},
    {"nome": "BATATA-BAROA (MANDIOQUINHA)", "grupo": "TUBERCULOS",  "classificacao_guia": "in natura"},
    {"nome": "CARÁ",                        "grupo": "TUBERCULOS",  "classificacao_guia": "in natura"},
    {"nome": "INHAME",                      "grupo": "TUBERCULOS",  "classificacao_guia": "in natura"},

    # ── LEITE E QUEIJOS ────────────────────────────────────────────────────
    # Guia — leite pasteurizado/UHT e derivados sem açúcar = minimamente
    # processados (Grupo 1b: pasteurização, secagem). Queijos com sal =
    # processados (Grupo 3).
    {"nome": "LEITE INTEGRAL",              "grupo": "LATICINIOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "LEITE SEMIDESNATADO",         "grupo": "LATICINIOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "LEITE DESNATADO",             "grupo": "LATICINIOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "LEITE EM PÓ",                 "grupo": "LATICINIOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "COALHADA",                    "grupo": "LATICINIOS",  "classificacao_guia": "minimamente processado"},
    {"nome": "IOGURTE NATURAL (SEM AÇÚCAR)","grupo": "LATICINIOS",  "classificacao_guia": "minimamente processado"},
    # Processados — fabricados com adição de sal (Grupo 3)
    {"nome": "QUEIJO MINAS FRESCAL",        "grupo": "LATICINIOS",  "classificacao_guia": "processado"},
    {"nome": "QUEIJO COALHO",               "grupo": "LATICINIOS",  "classificacao_guia": "processado"},
    {"nome": "QUEIJO MUSSARELA",            "grupo": "LATICINIOS",  "classificacao_guia": "processado"},

    # ── CARNES E OVOS ─────────────────────────────────────────────────────
    # Guia Cap. 3 — carnes vermelhas com moderação; preferência a aves e
    # peixes; ovos como proteína acessível.
    # Nomes genéricos conforme o Guia (sem especificação de corte).
    # Obs.: Pescados (73 itens) já cadastrados no seed principal.
    {"nome": "CARNE BOVINA",                "grupo": "CARNES",      "classificacao_guia": "in natura"},
    {"nome": "CARNE SUÍNA",                 "grupo": "CARNES",      "classificacao_guia": "in natura"},
    {"nome": "CARNE DE CABRITO",            "grupo": "CARNES",      "classificacao_guia": "in natura"},
    {"nome": "CARNE DE CORDEIRO",           "grupo": "CARNES",      "classificacao_guia": "in natura"},
    {"nome": "FRANGO",                      "grupo": "CARNES",      "classificacao_guia": "in natura"},
    {"nome": "PATO",                        "grupo": "CARNES",      "classificacao_guia": "in natura"},
    {"nome": "OVO DE GALINHA",              "grupo": "CARNES",      "classificacao_guia": "in natura"},
    # Processados — salga, cura e conserva em óleo (Grupo 3)
    {"nome": "CARNE SECA (CHARQUE)",        "grupo": "CARNES",      "classificacao_guia": "processado"},
    {"nome": "TOUCINHO SALGADO",            "grupo": "CARNES",      "classificacao_guia": "processado"},
    {"nome": "SARDINHA EM LATA",            "grupo": "CARNES",      "classificacao_guia": "processado"},
    {"nome": "ATUM EM LATA",                "grupo": "CARNES",      "classificacao_guia": "processado"},

    # ── OLEAGINOSAS ────────────────────────────────────────────────────────
    # Guia — castanhas, nozes e amendoim sem adição = in natura (Grupo 1).
    # Com sal ou açúcar = processados (Grupo 3).
    {"nome": "CASTANHA-DE-CAJU",            "grupo": "OLEAGINOSAS", "classificacao_guia": "in natura"},
    {"nome": "CASTANHA-DO-PARÁ",            "grupo": "OLEAGINOSAS", "classificacao_guia": "in natura"},
    {"nome": "CASTANHA-DE-BARU",            "grupo": "OLEAGINOSAS", "classificacao_guia": "in natura"},
    {"nome": "NOZES",                       "grupo": "OLEAGINOSAS", "classificacao_guia": "in natura"},
    {"nome": "AMÊNDOAS",                    "grupo": "OLEAGINOSAS", "classificacao_guia": "in natura"},
    {"nome": "AMENDOIM",                    "grupo": "OLEAGINOSAS", "classificacao_guia": "in natura"},
    # Processados — com adição de sal ou açúcar (Grupo 3)
    {"nome": "AMENDOIM SALGADO",            "grupo": "OLEAGINOSAS", "classificacao_guia": "processado"},
    {"nome": "CASTANHA SALGADA",            "grupo": "OLEAGINOSAS", "classificacao_guia": "processado"},

    # ── BEBIDAS ────────────────────────────────────────────────────────────
    # Guia Cap. 3 — "água, café e chá são as bebidas mais indicadas".
    {"nome": "CAFÉ",                        "grupo": "BEBIDAS",     "classificacao_guia": "in natura"},
    {"nome": "CHÁ DE ERVAS",                "grupo": "BEBIDAS",     "classificacao_guia": "in natura"},
    {"nome": "ÁGUA DE COCO",                "grupo": "BEBIDAS",     "classificacao_guia": "in natura"},

    # ── TEMPEROS NATURAIS E ESPECIARIAS ───────────────────────────────────
    # Guia Cap. 3 — ervas aromáticas e especiarias como tempero natural;
    # alternativa saudável ao sal e temperos industrializados.
    {"nome": "ALHO",                        "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "LOURO",                       "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "SALSINHA",                    "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "CEBOLINHA",                   "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "PIMENTA",                     "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "COENTRO",                     "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "HORTELÃ",                     "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "CRAVO",                       "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "CANELA",                      "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "ALECRIM",                     "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "TOMILHO",                     "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},
    {"nome": "SÁLVIA",                      "grupo": "TEMPEROS",    "classificacao_guia": "in natura"},

    # ── ÓLEOS E GORDURAS — INGREDIENTES CULINÁRIOS (GRUPO 2) ──────────────
    # Guia Cap. 2 — "óleos vegetais, manteiga, banha em pequenas
    # quantidades ao temperar e cozinhar".
    {"nome": "ÓLEO DE SOJA",                "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},
    {"nome": "ÓLEO DE MILHO",               "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},
    {"nome": "ÓLEO DE GIRASSOL",            "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},
    {"nome": "AZEITE DE OLIVA",             "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},
    {"nome": "ÓLEO DE CANOLA",              "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},
    {"nome": "MANTEIGA",                    "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},
    {"nome": "BANHA DE PORCO",              "grupo": "OLEOS",       "classificacao_guia": "ingrediente culinario"},

    # ── AÇÚCARES — INGREDIENTES CULINÁRIOS (GRUPO 2) ──────────────────────
    # Guia Cap. 2 — "açúcar em pequenas quantidades"; menos refinados
    # preservam mais micronutrientes.
    {"nome": "AÇÚCAR BRANCO",               "grupo": "ACUCARES",    "classificacao_guia": "ingrediente culinario"},
    {"nome": "AÇÚCAR DEMERARA",             "grupo": "ACUCARES",    "classificacao_guia": "ingrediente culinario"},
    {"nome": "AÇÚCAR MASCAVO",              "grupo": "ACUCARES",    "classificacao_guia": "ingrediente culinario"},

    # ── SAL — INGREDIENTE CULINÁRIO (GRUPO 2) ─────────────────────────────
    # Guia Cap. 2 — "sal refinado ou grosso em pequenas quantidades".
    {"nome": "SAL REFINADO",                "grupo": "SAL",         "classificacao_guia": "ingrediente culinario"},
    {"nome": "SAL GROSSO",                  "grupo": "SAL",         "classificacao_guia": "ingrediente culinario"},

    # ── CONSERVAS E PROCESSADOS (GRUPO 3 — NOVA) ──────────────────────────
    # Guia Cap. 2 — alimentos do Grupo 3: preparados com adição de sal,
    # açúcar, óleo ou vinagre a alimentos in natura.
    # "Se utilizar conservas, dê preferência às com menor teor de sal."
    {"nome": "CENOURA EM CONSERVA (SALMOURA)",  "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "PEPINO EM CONSERVA (SALMOURA)",   "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "ERVILHA EM LATA",                 "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "PALMITO EM CONSERVA",             "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "CEBOLA EM CONSERVA",              "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "COUVE-FLOR EM CONSERVA",          "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "EXTRATO DE TOMATE",               "grupo": "CONSERVAS", "classificacao_guia": "processado"},
    {"nome": "FRUTAS EM CALDA",                 "grupo": "CONSERVAS", "classificacao_guia": "processado"},

    # ── ULTRAPROCESSADOS (GRUPO 4 — NOVA) ─────────────────────────────────
    # Guia Cap. 2 — "evite o consumo de alimentos ultraprocessados".
    # Formulações industriais com substâncias extraídas de alimentos
    # (proteínas, amidos, gorduras hidrogenadas) + aditivos cosméticos.
    # !! CRITÉRIO NEGATIVO no checklist qualitativo das refeições !!
    # Identificados via classificacao_guia = 'ultraprocessado'.

    # Biscoitos, guloseimas e cereais industriais
    {"nome": "BISCOITO RECHEADO",               "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "BISCOITO CREAM CRACKER/MAIZENA",  "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "SORVETE INDUSTRIAL",              "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "BALAS E GOMAS DE MASCAR",         "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "CEREAL MATINAL AÇUCARADO",        "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "BARRA DE CEREAL INDUSTRIALIZADA", "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "BOLO INDUSTRIALIZADO",            "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "MISTURA PARA BOLO (PÓ)",          "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},

    # Refeições e temperos instantâneos
    {"nome": "MACARRÃO INSTANTÂNEO (MIOJO)",    "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "SOPA INSTANTÂNEA (PÓ/COPO)",      "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "TEMPERO INDUSTRIALIZADO (SACHÊ/TABLETE)", "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "MOLHO INDUSTRIALIZADO (KETCHUP/MAIONESE)", "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "SALGADINHO DE PACOTE",            "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},

    # Bebidas industriais
    {"nome": "REFRIGERANTE",                    "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "BEBIDA ENERGÉTICA",               "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "REFRESCO EM PÓ (TANG E SIMILARES)", "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},

    # Lácteos industriais adoçados/aromatizados
    {"nome": "IOGURTE ADOÇADO/AROMATIZADO",     "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "BEBIDA LÁCTEA ADOÇADA",           "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},

    # Refeições prontas congeladas
    {"nome": "PIZZA CONGELADA",                 "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "HAMBÚRGUER CONGELADO INDUSTRIAL", "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "LASANHA CONGELADA INDUSTRIAL",    "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},

    # Carnes ultraprocessadas (embutidos, extratados empanados)
    {"nome": "NUGGETS DE FRANGO",               "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "SALSICHA",                        "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "LINGUIÇA INDUSTRIAL",             "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "PRESUNTO",                        "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "MORTADELA",                       "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "PEITO DE PERU DEFUMADO",          "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},

    # Panificados industriais com gordura hidrogenada, açúcar, soro de leite
    # e emulsificantes — diferente do pão básico (processado)
    {"nome": "PÃO DE FORMA",                    "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "PÃO DE HAMBÚRGUER/HOT-DOG",       "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
    {"nome": "PÃO DOCE INDUSTRIALIZADO",        "grupo": "ULTRAPROCESSADOS", "classificacao_guia": "ultraprocessado"},
]


def seed_basicos():
    with app.app_context():
        print("=" * 65)
        print("Seed de Alimentos Básicos — Guia Alimentar Brasileiro 2014")
        print("=" * 65)

        adicionados = []
        pulados = []

        for item in ALIMENTOS_BASICOS:
            existente = Alimento.query.filter(db.func.lower(Alimento.nome) == item["nome"].lower()).first()
            if existente:
                # Atualiza para a versão mais recente do item na lista acima
                existente.nome = item["nome"]
                existente.grupo = item["grupo"]
                existente.classificacao_guia = item["classificacao_guia"]
                pulados.append(item["nome"])
                continue

            alimento = Alimento(
                nome=item["nome"],
                grupo=item["grupo"],
                classificacao_guia=item["classificacao_guia"],
                codigo_barras=None,
                dados_completos=None,
            )
            db.session.add(alimento)
            adicionados.append(item)

        db.session.commit()

        # Contagem por classificação
        contagem = {}
        for item in adicionados:
            c = item["classificacao_guia"]
            contagem[c] = contagem.get(c, 0) + 1

        print(f"\n[OK] Inseridos: {len(adicionados)} alimentos")
        if pulados:
            print(f"[--] Já existiam (pulados): {len(pulados)}")
            for nome in pulados:
                print(f"     - {nome}")

        if adicionados:
            print("\nResumo por classificação NOVA:")
            ordem = ["in natura", "minimamente processado",
                     "ingrediente culinario", "processado", "ultraprocessado"]
            for c in ordem:
                if c in contagem:
                    print(f"   {c:<30} {contagem[c]:>3} itens")

            print("\nAlimentos inseridos por grupo:")
            grupo_atual = None
            for item in adicionados:
                if item["grupo"] != grupo_atual:
                    grupo_atual = item["grupo"]
                    print(f"\n  [{grupo_atual}]")
                print(f"   + {item['nome']} ({item['classificacao_guia']})")

        print("\nSeed concluído com sucesso!")
        return adicionados


if __name__ == "__main__":
    seed_basicos()
