describe('Minhas Refeicoes (/prato)', () => {
  it('exibe o estado vazio quando nao ha refeicoes', () => {
    cy.intercept('GET', '**/api/refeicoes**', { statusCode: 200, body: [] }).as('listar');
    cy.visitAutenticado('/prato');
    cy.wait('@listar');
    cy.contains('Nenhuma refeição adicionada').should('be.visible');
  });

  it('lista as refeicoes retornadas pela API', () => {
    cy.intercept('GET', '**/api/refeicoes**', {
      statusCode: 200,
      body: [
        { id: 1, nome_refeicao: 'Almoço de segunda', tipo_refeicao: 'almoco', data_criacao: new Date().toISOString(), total_itens: 2 },
      ],
    }).as('listar');

    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#refeicao-1').should('be.visible').and('contain.text', 'Almoço de segunda');
  });

  it('nao chama a API ao tentar criar uma refeicao sem nome', () => {
    cy.intercept('GET', '**/api/refeicoes**', { statusCode: 200, body: [] }).as('listar');
    cy.intercept('POST', '**/api/refeicoes').as('criar');

    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#btn-criar-primeira').click();
    cy.get('#btn-confirmar-refeicao').click();

    cy.contains('Dê um nome para a refeição.').should('be.visible');
    cy.get('@criar.all').should('have.length', 0);
  });

  it('cria uma nova refeicao com sucesso e navega para o detalhe', () => {
    cy.intercept('GET', '**/api/refeicoes**', { statusCode: 200, body: [] }).as('listar');
    cy.intercept('POST', '**/api/refeicoes', {
      statusCode: 201,
      body: { id: 42, nome_refeicao: 'Jantar', tipo_refeicao: 'jantar', data_criacao: new Date().toISOString(), total_itens: 0, itens: [] },
    }).as('criar');

    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#btn-criar-primeira').click();
    cy.get('#nome-refeicao').type('Jantar');
    cy.get('#tipo-jantar').click();
    cy.get('#btn-confirmar-refeicao').click();

    cy.wait('@criar').its('request.body').should('deep.equal', { nome_refeicao: 'Jantar', tipo_refeicao: 'jantar' });
    cy.url().should('include', '/prato/42');
  });

  it('mesmo com a API indisponivel, cria a refeicao localmente e navega para o detalhe', () => {
    cy.intercept('GET', '**/api/refeicoes**', { statusCode: 200, body: [] }).as('listar');
    cy.intercept('POST', '**/api/refeicoes', { statusCode: 500, body: { error: 'erro interno' } }).as('criar');

    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#btn-criar-primeira').click();
    cy.get('#nome-refeicao').type('Café da tarde');
    cy.get('#btn-confirmar-refeicao').click();

    cy.wait('@criar');
    cy.url().should('match', /\/prato\/-\d+/);
  });

  it('exclui uma refeicao apos confirmar no dialogo', () => {
    cy.intercept('GET', '**/api/refeicoes**', {
      statusCode: 200,
      body: [
        { id: 1, nome_refeicao: 'Almoço de segunda', tipo_refeicao: 'almoco', data_criacao: new Date().toISOString(), total_itens: 0 },
      ],
    }).as('listar');
    cy.intercept('DELETE', '**/api/refeicoes/1', { statusCode: 200, body: {} }).as('deletar');

    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#btn-deletar-1').click();
    cy.contains('.modal button', 'Confirmar').click();

    cy.wait('@deletar');
    cy.get('#refeicao-1').should('not.exist');
    cy.contains('Nenhuma refeição adicionada').should('be.visible');
  });

  it('mantem a refeicao ao cancelar a exclusao', () => {
    cy.intercept('GET', '**/api/refeicoes**', {
      statusCode: 200,
      body: [
        { id: 1, nome_refeicao: 'Almoço de segunda', tipo_refeicao: 'almoco', data_criacao: new Date().toISOString(), total_itens: 0 },
      ],
    }).as('listar');
    cy.intercept('DELETE', '**/api/refeicoes/1').as('deletar');

    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#btn-deletar-1').click();
    cy.contains('.modal button', 'Cancelar').click();

    cy.get('@deletar.all').should('have.length', 0);
    cy.get('#refeicao-1').should('be.visible');
  });

  it('mostra as refeicoes cacheadas localmente quando a API fica indisponivel', () => {
    cy.intercept('GET', '**/api/refeicoes**', {
      statusCode: 200,
      body: [
        { id: 1, nome_refeicao: 'Almoço de segunda', tipo_refeicao: 'almoco', data_criacao: new Date().toISOString(), total_itens: 0 },
      ],
    }).as('listarOk');
    cy.visitAutenticado('/prato');
    cy.wait('@listarOk');
    cy.get('#refeicao-1').should('be.visible');

    // Recarrega com o backend fora do ar: deve continuar mostrando o cache local (Dexie).
    cy.intercept('GET', '**/api/refeicoes**', { forceNetworkError: true }).as('listarFalha');
    cy.visitAutenticado('/prato');
    cy.wait('@listarFalha');
    cy.get('#refeicao-1').should('be.visible');
  });

  it('volta para /home ao clicar no botao de voltar', () => {
    cy.intercept('GET', '**/api/refeicoes**', { statusCode: 200, body: [] }).as('listar');
    cy.visitAutenticado('/prato');
    cy.wait('@listar');

    cy.get('#btn-voltar-prato').click();
    cy.url().should('include', '/home');
  });
});
