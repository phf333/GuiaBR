from app.models import Alimento, Sazonalidade, mes_atual
from app.routes.refeicoes import _analisar_refeicao


def test_categoria_guia_fruta():
    alimento = Alimento(nome="Banana", grupo="FRUTAS")
    assert alimento.categoria_guia == "fruta"


def test_categoria_guia_ultraprocessado_prevalece_sobre_grupo():
    alimento = Alimento(nome="Salgadinho", grupo="CEREAIS", classificacao_guia="ultraprocessado")
    assert alimento.categoria_guia == "ultraprocessado"


def test_categoria_guia_grupo_desconhecido_cai_em_outro():
    alimento = Alimento(nome="Item raro", grupo="XPTO")
    assert alimento.categoria_guia == "outro"


def test_categoria_guia_corrige_grupo_comercial_da_ceagesp():
    assert Alimento(nome="MANDIOCA", grupo="LEGUMES").categoria_guia == "cereal_tuberculo"
    assert Alimento(nome="ERVILHA", grupo="LEGUMES").categoria_guia == "leguminosa"
    assert Alimento(nome="CASTANHA", grupo="FRUTAS").categoria_guia == "oleaginosa"
    assert Alimento(nome="OVOS", grupo="DIVERSOS").categoria_guia == "proteina"


def test_analisar_almoco_com_produtos_da_ceagesp_e_adequado():
    itens = [
        Alimento(nome="MANDIOCA", grupo="LEGUMES"),
        Alimento(nome="FEIJÃO-DE-CORDA", grupo="LEGUMES"),
        Alimento(nome="ALFACE", grupo="VERDURAS"),
        Alimento(nome="OVOS", grupo="DIVERSOS"),
    ]
    resultado = _analisar_refeicao("almoco", itens)
    assert resultado["classificacao"] == "adequada"
    assert all(c["cumprido"] for c in resultado["checklist"])


def test_sazonalidade_atual_retorna_none_sem_safra_para_o_mes():
    alimento = Alimento(nome="Manga", grupo="FRUTAS")
    alimento.safras = [Sazonalidade(mes=(mes_atual() % 12) + 1, safra_atual=4)]
    assert alimento.sazonalidade_atual is None


def test_sazonalidade_atual_classifica_nivel_alta():
    alimento = Alimento(nome="Manga", grupo="FRUTAS")
    alimento.safras = [Sazonalidade(mes=mes_atual(), safra_atual=4)]
    resultado = alimento.sazonalidade_atual
    assert resultado["nivel"] == "alta"
    assert resultado["texto"] == "Safra Alta"


def test_analisar_refeicao_almoco_adequado():
    itens = [
        Alimento(nome="Arroz", grupo="CEREAIS"),
        Alimento(nome="Feijão", grupo="LEGUMINOSAS"),
        Alimento(nome="Alface", grupo="VERDURAS"),
    ]
    resultado = _analisar_refeicao("almoco", itens)
    assert resultado["classificacao"] == "adequada"
    assert resultado["obrigatorios_cumpridos"] == resultado["obrigatorios_total"]


def test_analisar_refeicao_com_ultraprocessado_e_inadequada():
    itens = [
        Alimento(nome="Arroz", grupo="CEREAIS"),
        Alimento(nome="Feijão", grupo="LEGUMINOSAS"),
        Alimento(nome="Alface", grupo="VERDURAS"),
        Alimento(nome="Salgadinho", grupo="OUTROS", classificacao_guia="ultraprocessado"),
    ]
    resultado = _analisar_refeicao("almoco", itens)
    assert resultado["classificacao"] == "inadequada"
    assert "ultraprocessado" in resultado["mensagem"].lower()


def test_analisar_refeicao_faltando_um_item_obrigatorio_e_parcial():
    itens = [
        Alimento(nome="Arroz", grupo="CEREAIS"),
        Alimento(nome="Feijão", grupo="LEGUMINOSAS"),
    ]
    resultado = _analisar_refeicao("almoco", itens)
    assert resultado["classificacao"] == "parcial"
