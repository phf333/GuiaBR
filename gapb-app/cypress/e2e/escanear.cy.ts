describe('Escanear Alimento (/escanear)', () => {
  it('exibe o estado vazio quando nao ha historico', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', { statusCode: 200, body: [] }).as('historico');
    cy.visitAutenticado('/escanear');
    cy.wait('@historico');
    cy.contains('Nenhum produto escaneado').should('be.visible');
  });

  it('lista o historico retornado pela API', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', {
      statusCode: 200,
      body: [
        { codigo_barras: '7891000100103', nome: 'Arroz Integral', marca: null, quantidade: null, nova_group: 1, classificacao_guia: 'in natura', imagem_url: null },
        { codigo_barras: '7891000053508', nome: 'Refrigerante Cola', marca: null, quantidade: null, nova_group: 4, classificacao_guia: 'ultraprocessado', imagem_url: null },
      ],
    }).as('historico');

    cy.visitAutenticado('/escanear');
    cy.wait('@historico');

    cy.contains('p', 'Arroz Integral').should('be.visible');
    cy.contains('p', 'Refrigerante Cola').should('be.visible');
  });

  it('ao clicar em um item do historico, navega para /resultado', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', {
      statusCode: 200,
      body: [
        { codigo_barras: '7891000100103', nome: 'Arroz Integral', marca: null, quantidade: null, nova_group: 1, classificacao_guia: 'in natura', imagem_url: null },
      ],
    }).as('historico');
    cy.visitAutenticado('/escanear');
    cy.wait('@historico');

    cy.contains('p', 'Arroz Integral').click();
    cy.url().should('include', '/resultado');
    cy.contains('ALIMENTO IN NATURA').should('be.visible');
  });

  it('remove um item do historico apos confirmar no dialogo', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', {
      statusCode: 200,
      body: [
        { codigo_barras: '7891000100103', nome: 'Arroz Integral', marca: null, quantidade: null, nova_group: 1, classificacao_guia: 'in natura', imagem_url: null },
      ],
    }).as('historico');
    cy.intercept('DELETE', '**/api/alimentos/historico/7891000100103', { statusCode: 200, body: {} }).as('excluir');

    cy.visitAutenticado('/escanear');
    cy.wait('@historico');

    cy.get('#btn-deletar-7891000100103').click();
    cy.contains('.modal button', 'Confirmar').click();

    cy.wait('@excluir');
    cy.contains('p', 'Arroz Integral').should('not.exist');
    cy.contains('Nenhum produto escaneado').should('be.visible');
  });

  it('mantem o cache local quando a API do historico falha', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', {
      statusCode: 200,
      body: [
        { codigo_barras: '7891000100103', nome: 'Arroz Integral', marca: null, quantidade: null, nova_group: 1, classificacao_guia: 'in natura', imagem_url: null },
      ],
    }).as('historicoOk');
    cy.visitAutenticado('/escanear');
    cy.wait('@historicoOk');
    cy.contains('p', 'Arroz Integral').should('be.visible');

    // Recarrega a pagina com o backend indisponivel: deve continuar mostrando o cache local.
    cy.intercept('GET', '**/api/alimentos/historico**', { forceNetworkError: true }).as('historicoFalha');
    cy.visitAutenticado('/escanear');
    cy.wait('@historicoFalha');
    cy.contains('p', 'Arroz Integral').should('be.visible');
  });

  it('busca os detalhes do produto ao escanear um codigo de barras valido', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', { statusCode: 200, body: [] }).as('historico');
    cy.intercept('GET', '**/api/alimentos/busca**', {
      statusCode: 200,
      body: { codigo_barras: '7891000053508', nome: 'Biscoito Recheado', marca: null, quantidade: null, nova_group: 4, classificacao_guia: 'ultraprocessado', imagem_url: null },
    }).as('busca');

    cy.visitAutenticado('/escanear');
    cy.wait('@historico');

    cy.ngComponent('pag-escaneamento').then((comp: any) => {
      comp.handleScanSuccess('7891000053508'); // EAN-13 valido
    });

    cy.wait('@busca').its('request.url').should('include', 'codigo=7891000053508');
    cy.url().should('include', '/resultado');
  });

  it('ignora codigos de barras invalidos sem chamar a API', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', { statusCode: 200, body: [] }).as('historico');
    cy.intercept('GET', '**/api/alimentos/busca**').as('busca');

    cy.visitAutenticado('/escanear');
    cy.wait('@historico');

    cy.ngComponent('pag-escaneamento').then((comp: any) => {
      comp.handleScanSuccess('123456'); // digito verificador invalido / tamanho invalido
    });

    cy.get('@busca.all').should('have.length', 0);
    cy.url().should('include', '/escanear');
  });

  it('mostra um alerta quando o produto nao e encontrado', () => {
    cy.intercept('GET', '**/api/alimentos/historico**', { statusCode: 200, body: [] }).as('historico');
    cy.intercept('GET', '**/api/alimentos/busca**', { statusCode: 404, body: { error: 'not found' } }).as('busca');

    cy.visitAutenticado('/escanear');
    cy.wait('@historico');

    cy.ngComponent('pag-escaneamento').then((comp: any) => {
      comp.handleScanSuccess('7891000053508');
    });

    cy.wait('@busca');
    cy.contains('.modal', 'Produto não encontrado ou não cadastrado na base de dados.').should('be.visible');
  });
});
