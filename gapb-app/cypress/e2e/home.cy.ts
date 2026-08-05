describe('Tela inicial (/home)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/capitulos**', {
      statusCode: 200,
      body: [
        { numero: 1, status: 'done' },
        { numero: 2, status: 'done' },
        { numero: 3, status: 'active' },
        { numero: 4, status: 'active' },
        { numero: 5, status: 'active' },
        { numero: 6, status: 'active' },
      ],
    }).as('capitulos');

    cy.visitAutenticado('/home');
  });

  it('exibe a saudacao com o primeiro nome do usuario logado', () => {
    cy.contains('h1', 'Olá, Usuaria!').should('be.visible');
  });

  it('exibe os 3 cards de menu', () => {
    cy.contains('p', 'Guia Alimentar').should('be.visible');
    cy.contains('p', 'Escanear Alimento').should('be.visible');
    cy.contains('p', 'Monte seu prato').should('be.visible');
  });

  it('atualiza o subtitulo do card do guia com o progresso vindo da API', () => {
    cy.wait('@capitulos');
    cy.contains('p', /^Guia Alimentar$/)
      .parent()
      .contains('2/6 capítulos concluídos')
      .should('be.visible');
  });

  it('navega para /escanear ao clicar no card de escanear', () => {
    cy.contains('p', 'Escanear Alimento').click();
    cy.url().should('include', '/escanear');
  });

  it('navega para /guia ao clicar no card do guia', () => {
    cy.contains('p', /^Guia Alimentar$/).click();
    cy.url().should('include', '/guia');
  });

  it('navega para /prato ao clicar no card de montar prato', () => {
    cy.contains('p', 'Monte seu prato').click();
    cy.url().should('include', '/prato');
  });

  it('faz logout, limpa a sessao e redireciona para /login', () => {
    cy.get('#btn-logout').click();
    cy.url().should('include', '/login');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('guiabr_token')).to.be.null;
      expect(win.localStorage.getItem('guiabr_usuario')).to.be.null;
    });
  });
});
