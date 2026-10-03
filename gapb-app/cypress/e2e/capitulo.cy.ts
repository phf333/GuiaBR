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

    cy.intercept('POST', '**/api/capitulos/*/posicao', { statusCode: 200, body: [] }).as('posicao');

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

    // Ao abrir, o componente reposiciona o carrossel apos 50ms (ngAfterViewInit); rolar antes
    // disso e desfeito por esse ajuste. Um usuario real nunca rola tao cedo.
    cy.wait(100);

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

  it('envia ao servidor o card em que a leitura parou ao sair do capitulo', () => {
    cy.contains('p', 'A Escolha dos Alimentos').click();
    cy.url().should('include', '/guia/capitulo');
    cy.wait(100); // ver comentario no teste de conclusao: o carrossel se reposiciona ao abrir

    cy.get('.card-conteudo--fundamento').then(($cards) => {
      const carrossel = $cards[0].parentElement as HTMLElement;
      carrossel.scrollLeft = ($cards[1] as HTMLElement).offsetLeft - 16;
      carrossel.dispatchEvent(new Event('scroll'));
    });
    cy.ngComponent('app-capitulo').its('paginaAtiva').should('eq', 1);

    cy.get('.icon-btn').first().click();

    cy.wait('@posicao').then(({ request }) => {
      expect(request.url).to.include('/api/capitulos/2/posicao');
      expect(request.body).to.deep.equal({ ultimo_card: 1 });
    });
  });

  it('reabre o capitulo no card salvo no servidor', () => {
    cy.intercept('GET', '**/api/capitulos**', {
      statusCode: 200,
      body: [
        { numero: 1, status: 'active', ultimo_card: 0 },
        { numero: 2, status: 'active', ultimo_card: 2 },
        { numero: 3, status: 'active', ultimo_card: 0 },
        { numero: 4, status: 'active', ultimo_card: 0 },
        { numero: 5, status: 'active', ultimo_card: 0 },
        { numero: 6, status: 'active', ultimo_card: 0 },
      ],
    }).as('capitulosComPosicao');
    cy.visitAutenticado('/guia');
    cy.wait('@capitulosComPosicao');

    cy.contains('p', 'A Escolha dos Alimentos').click();
    cy.url().should('include', '/guia/capitulo');

    cy.ngComponent('app-capitulo').its('paginaAtiva').should('eq', 2);
  });
});
