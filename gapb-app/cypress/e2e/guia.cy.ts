describe('Guia Alimentar (/guia)', () => {
  const progressoInicial = [
    { numero: 1, status: 'active' },
    { numero: 2, status: 'active' },
    { numero: 3, status: 'locked' },
    { numero: 4, status: 'active' },
    { numero: 5, status: 'active' },
    { numero: 6, status: 'active' },
  ];

  beforeEach(() => {
    cy.intercept('GET', '**/api/capitulos**', {
      statusCode: 200,
      body: progressoInicial,
    }).as('capitulos');

    cy.visitAutenticado('/guia');
    cy.wait('@capitulos');
  });

  it('lista os 6 capitulos com o progresso vindo da API', () => {
    cy.contains('p', 'Princípios').should('be.visible');
    cy.contains('p', 'A Escolha dos Alimentos').should('be.visible');
    cy.contains('p', 'Dos Alimentos à Refeição').should('be.visible');
    cy.contains('p', 'Dez Passos para uma Alimentação Adequada e Saudável').scrollIntoView().should('be.visible');
    cy.contains('0 de 6 capítulos concluídos').should('be.visible');
  });

  it('nao navega ao clicar em um capitulo bloqueado (locked)', () => {
    cy.contains('p', 'Dos Alimentos à Refeição').click();
    cy.url().should('include', '/guia');
    cy.url().should('not.include', '/capitulo');
  });

  it('abre um capitulo ativo e mostra seu conteudo', () => {
    cy.contains('p', 'Princípios').click();
    cy.url().should('include', '/guia/capitulo');
    cy.contains('Alimentação diz respeito à ingestão de nutrientes').should('be.visible');
  });

  it('exibe o link externo para o PDF oficial do guia', () => {
    cy.contains('a', 'Acessar Guia Completo (PDF)')
      .should('have.attr', 'href')
      .and('include', 'guia_alimentar_populacao_brasileira');
  });

  it('reseta o progresso apos confirmar no dialogo', () => {
    cy.intercept('POST', '**/api/capitulos/reset', {
      statusCode: 200,
      body: [
        { numero: 1, status: 'active' },
        { numero: 2, status: 'active' },
        { numero: 3, status: 'active' },
        { numero: 4, status: 'active' },
        { numero: 5, status: 'active' },
        { numero: 6, status: 'active' },
      ],
    }).as('reset');

    cy.get('#btn-resetar-progresso').click();
    cy.contains('.modal button', 'Confirmar').click();

    cy.wait('@reset');
    cy.contains('p', 'Dos Alimentos à Refeição').click();
    cy.url().should('include', '/guia/capitulo');
  });

  it('cancela o reset de progresso ao clicar em Cancelar', () => {
    cy.get('#btn-resetar-progresso').click();
    cy.contains('.modal button', 'Cancelar').click();
    cy.get('.modal-overlay').should('not.exist');
    cy.contains('p', 'Dos Alimentos à Refeição').click();
    cy.url().should('not.include', '/capitulo');
  });
});
