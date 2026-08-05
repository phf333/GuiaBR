describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('exibe o formulario de login', () => {
    cy.contains('h1', 'GuiaBR');
    cy.get('#email').should('be.visible');
    cy.get('#senha').should('be.visible');
  });

  it('faz login com sucesso e redireciona para /home', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        access_token: 'fake-jwt-token',
        usuario: { id: 1, nome: 'Usuaria Teste', email: 'teste@guiabr.com' },
      },
    }).as('login');

    cy.get('#email').type('teste@guiabr.com');
    cy.get('#senha').type('senha123');
    cy.get('button[type=submit]').click();

    cy.wait('@login');
    cy.url().should('include', '/home');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('guiabr_token')).to.eq('fake-jwt-token');
    });
  });

  it('mostra erro quando as credenciais estao incorretas', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: { error: 'E-mail ou senha incorretos' },
    }).as('login');

    cy.get('#email').type('teste@guiabr.com');
    cy.get('#senha').type('senhaerrada');
    cy.get('button[type=submit]').click();

    cy.wait('@login');
    cy.contains('E-mail ou senha incorretos').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('mostra mensagem generica quando a API falha inesperadamente', () => {
    cy.intercept('POST', '**/api/auth/login', { forceNetworkError: true }).as('login');

    cy.get('#email').type('teste@guiabr.com');
    cy.get('#senha').type('senha123');
    cy.get('button[type=submit]').click();

    cy.wait('@login');
    cy.contains('Erro ao fazer login. Tente novamente.').should('be.visible');
  });

  it('navega para a tela de registro', () => {
    cy.contains('a', 'Criar conta').click();
    cy.url().should('include', '/registro');
  });
});
