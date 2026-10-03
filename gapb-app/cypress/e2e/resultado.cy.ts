describe('Resultado do Escaneamento (/resultado)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/alimentos/historico**', { statusCode: 200, body: [] }).as('historico');
    cy.visitAutenticado('/escanear');
    cy.wait('@historico');
  });

  it('exibe alerta vermelho para um produto ultraprocessado, com aviso de origem da classificacao', () => {
    cy.intercept('GET', '**/api/alimentos/busca**', {
      statusCode: 200,
      body: { codigo_barras: '7891000053508', nome: 'Biscoito Recheado', marca: 'MarcaX', quantidade: '200g', nova_group: 4, classificacao_guia: 'ultraprocessado', imagem_url: null },
    }).as('busca');

    cy.ngComponent('pag-escaneamento').then((comp: any) => comp.handleScanSuccess('7891000053508'));
    cy.wait('@busca');
    cy.url().should('include', '/resultado');

    cy.contains('Biscoito Recheado').should('be.visible');
    cy.contains('MarcaX – 200g').should('be.visible');
    cy.contains('ALIMENTO ULTRAPROCESSADO').should('be.visible');
    cy.contains('Open Food Facts').should('be.visible');
  });

  it('exibe alerta verde para um alimento in natura', () => {
    cy.intercept('GET', '**/api/alimentos/busca**', {
      statusCode: 200,
      body: { codigo_barras: '7891000053508', nome: 'Maçã', marca: null, quantidade: null, nova_group: 1, classificacao_guia: 'in natura', imagem_url: null },
    }).as('busca');

    cy.ngComponent('pag-escaneamento').then((comp: any) => comp.handleScanSuccess('7891000053508'));
    cy.wait('@busca');

    cy.contains('Maçã').should('be.visible');
    cy.contains('ALIMENTO IN NATURA').should('be.visible');
  });

  it('exibe classificacao indisponivel quando o produto nao tem grupo NOVA', () => {
    cy.intercept('GET', '**/api/alimentos/busca**', {
      statusCode: 200,
      body: { codigo_barras: '7891000053508', nome: 'Produto Sem Classificação', marca: null, quantidade: null, nova_group: null, classificacao_guia: 'indisponivel', imagem_url: null },
    }).as('busca');

    cy.ngComponent('pag-escaneamento').then((comp: any) => comp.handleScanSuccess('7891000053508'));
    cy.wait('@busca');

    cy.contains('CLASSIFICAÇÃO INDISPONÍVEL').should('be.visible');
  });

  it('volta para /escanear ao clicar no botao de voltar', () => {
    cy.intercept('GET', '**/api/alimentos/busca**', {
      statusCode: 200,
      body: { codigo_barras: '7891000053508', nome: 'Maçã', marca: null, quantidade: null, nova_group: 1, classificacao_guia: 'in natura', imagem_url: null },
    }).as('busca');

    cy.ngComponent('pag-escaneamento').then((comp: any) => comp.handleScanSuccess('7891000053508'));
    cy.wait('@busca');
    cy.url().should('include', '/resultado');

    cy.get('.icon-btn').first().click();
    cy.url().should('include', '/escanear');
  });
});
