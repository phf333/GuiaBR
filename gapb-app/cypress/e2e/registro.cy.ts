describe('Registro', () => {
  beforeEach(() => {
    cy.visit('/registro');
  });

  const preencherFormulario = (overrides: Partial<{
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
  }> = {}) => {
    const dados = {
      nome: 'Usuaria Teste',
      email: 'nova@guiabr.com',
      senha: 'senha123',
      confirmarSenha: 'senha123',
      ...overrides,
    };
    cy.get('#nome').type(dados.nome);
    cy.get('#email').type(dados.email);
    cy.get('#senha').type(dados.senha);
    cy.get('#confirmarSenha').type(dados.confirmarSenha);
  };

  it('exibe o formulario de criacao de conta', () => {
    cy.contains('h1', 'Criar conta');
    cy.get('#nome').should('be.visible');
  });

  it('cria a conta com sucesso e redireciona para /home', () => {
    cy.intercept('POST', '**/api/auth/register', {
      statusCode: 201,
      body: {
        access_token: 'fake-jwt-token',
        usuario: { id: 2, nome: 'Usuaria Teste', email: 'nova@guiabr.com' },
      },
    }).as('register');

    preencherFormulario();
    cy.get('button[type=submit]').click();

    cy.wait('@register');
    cy.url().should('include', '/home');
  });

  it('valida que as senhas devem coincidir antes de chamar a API', () => {
    preencherFormulario({ confirmarSenha: 'outrasenha' });
    cy.get('button[type=submit]').click();

    cy.contains('As senhas não coincidem.').should('be.visible');
  });

  it('valida o tamanho minimo da senha antes de chamar a API', () => {
    preencherFormulario({ senha: '123', confirmarSenha: '123' });
    cy.get('button[type=submit]').click();

    cy.contains('A senha deve ter pelo menos 6 caracteres.').should('be.visible');
  });

  it('mostra erro quando o e-mail ja esta cadastrado', () => {
    cy.intercept('POST', '**/api/auth/register', {
      statusCode: 409,
      body: { error: 'Este e-mail já está cadastrado' },
    }).as('register');

    preencherFormulario();
    cy.get('button[type=submit]').click();

    cy.wait('@register');
    cy.contains('Este e-mail já está cadastrado').should('be.visible');
  });

  it('navega para a tela de login', () => {
    cy.contains('a', 'Entrar').click();
    cy.url().should('include', '/login');
  });
});
