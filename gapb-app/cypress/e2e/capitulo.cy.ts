describe('Capitulo do Guia (/guia/capitulo)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/capitulos**', {
      statusCode: 200,
      body: [
        { numero: 1, status: 'active' },
        { numero: 2, status: 'active' },
        { numero: 3, status: 'active' },
        { numero: 4, status: 'active' },
        { numero: 5, status: 'active' },
        { numero: 6, status: 'active' },
      ],
    }).as('capitulos');

    cy.visitAutenticado('/guia');
    cy.wait('@capitulos');
  });

  it('redireciona de volta para /guia se acessado diretamente sem estado de navegacao', () => {
    cy.visitAutenticado('/guia/capitulo');
    cy.url().should('match', /\/guia$/);
  });

  it('abre o capitulo 1 mostrando titulo e os cards de fundamento', () => {
    cy.contains('p', 'Princípios').click();
    cy.url().should('include', '/guia/capitulo');

    cy.get('.card-conteudo--fundamento').should('have.length', 3);
    cy.contains('Alimentação diz respeito à ingestão de nutrientes').should('be.visible');
  });

  it('exibe o card "sabia que" quando o capitulo possui um', () => {
    cy.contains('p', 'A Escolha dos Alimentos').click();
    cy.url().should('include', '/guia/capitulo');
    cy.contains('Prefira sempre alimentos in natura ou minimamente processados')
      .scrollIntoView()
      .should('be.visible');
  });

  it('volta para /guia ao clicar no botao de voltar', () => {
    cy.contains('p', 'Princípios').click();
    cy.url().should('include', '/guia/capitulo');
    cy.get('.icon-btn').first().click();
    cy.url().should('match', /\/guia$/);
  });

  it('marca o capitulo como concluido ao navegar ate o ultimo card', () => {
    cy.intercept('POST', '**/api/capitulos/2/concluir', {
      statusCode: 200,
      body: [
        { numero: 1, status: 'active' },
        { numero: 2, status: 'done' },
        { numero: 3, status: 'active' },
        { numero: 4, status: 'active' },
        { numero: 5, status: 'active' },
        { numero: 6, status: 'active' },
      ],
    }).as('concluir');

    cy.contains('p', 'A Escolha dos Alimentos').click();
    cy.url().should('include', '/guia/capitulo');

    // Simula o usuario rolando o carrossel ate o ultimo card de fundamento,
    // que é o gatilho real (onScroll) para marcar o capitulo como concluido.
    cy.get('.card-conteudo--fundamento').then(($cards) => {
      const carrossel = $cards[0].parentElement as HTMLElement;
      const ultimoCard = $cards[$cards.length - 1] as HTMLElement;
      carrossel.scrollLeft = ultimoCard.offsetLeft - 16;
      carrossel.dispatchEvent(new Event('scroll'));
    });

    cy.wait('@concluir');
  });
});
