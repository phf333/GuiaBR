describe('Detalhe da Refeicao (/prato/:id)', () => {
  const refeicaoBase = {
    id: 1,
    nome_refeicao: 'Almoço de segunda',
    tipo_refeicao: 'almoco',
    data_criacao: new Date().toISOString(),
    total_itens: 0,
    itens: [] as any[],
  };

  const alimentos = [
    {
      id: 10,
      nome: 'Arroz Integral',
      grupo: 'Cereais',
      classificacao_guia: 'in natura',
      sazonalidade_atual: { valor: 4, texto: 'Em safra', nivel: 'alta' },
    },
    {
      id: 11,
      nome: 'Refrigerante Cola',
      grupo: 'Bebidas',
      classificacao_guia: 'ultraprocessado',
      sazonalidade_atual: null,
    },
  ];

  const seedAlimentos = () => {
    cy.ngComponent('app-prato-detalhe').then((comp: any) => {
      cy.wrap(comp.localDb.saveAlimentos(alimentos), { log: false });
    });
  };

  it('exibe o estado vazio de itens e permite buscar e adicionar um alimento', () => {
    cy.intercept('GET', '**/api/refeicoes/1**', { statusCode: 200, body: refeicaoBase }).as('obter');
    cy.intercept('POST', '**/api/refeicoes/1/itens', {
      statusCode: 200,
      body: {
        ...refeicaoBase,
        total_itens: 1,
        itens: [
          {
            alimento_id: 10,
            nome: 'Arroz Integral',
            grupo: 'Cereais',
            classificacao_guia: 'in natura',
            categoria_guia: '',
            sazonalidade_atual: { valor: 4, texto: 'Em safra', nivel: 'alta' },
          },
        ],
      },
    }).as('adicionar');

    cy.visitAutenticado('/prato/1');
    cy.wait('@obter');
    cy.contains('Use a busca abaixo para adicionar alimentos ao seu prato').should('be.visible');

    seedAlimentos();

    cy.get('#busca-alimento').type('Arroz');
    cy.wait(400); // debounce da busca (300ms)

    cy.contains('li', 'Arroz Integral').should('be.visible');
    cy.get('#btn-add-10').click();

    cy.wait('@adicionar').its('request.body').should('deep.equal', { alimento_id: 10 });
    cy.get('#item-10').should('contain.text', 'Arroz Integral');
  });

  it('filtra os resultados da busca por grau de processamento e por safra', () => {
    cy.intercept('GET', '**/api/refeicoes/1**', { statusCode: 200, body: refeicaoBase }).as('obter');
    cy.visitAutenticado('/prato/1');
    cy.wait('@obter');
    seedAlimentos();

    cy.get('#select-processamento').select('ultraprocessado');
    cy.wait(100);
    cy.contains('li', 'Refrigerante Cola').should('be.visible');
    cy.contains('li', 'Arroz Integral').should('not.exist');

    cy.get('#select-processamento').select('');
    cy.get('#btn-safra-toggle').click();
    cy.wait(100);
    cy.contains('li', 'Arroz Integral').should('be.visible');
    cy.contains('li', 'Refrigerante Cola').should('not.exist');
  });

  it('remove um item da refeicao', () => {
    const refeicaoComItem = {
      ...refeicaoBase,
      total_itens: 1,
      itens: [
        {
          alimento_id: 10,
          nome: 'Arroz Integral',
          grupo: 'Cereais',
          classificacao_guia: 'in natura',
          categoria_guia: '',
          sazonalidade_atual: { valor: 4, texto: 'Em safra', nivel: 'alta' },
        },
      ],
    };

    cy.intercept('GET', '**/api/refeicoes/1**', { statusCode: 200, body: refeicaoComItem }).as('obter');
    cy.intercept('DELETE', '**/api/refeicoes/1/itens/10', {
      statusCode: 200,
      body: { ...refeicaoBase, total_itens: 0, itens: [] },
    }).as('remover');

    cy.visitAutenticado('/prato/1');
    cy.wait('@obter');

    cy.get('#item-10').should('be.visible');
    cy.get('#btn-remover-10').click();

    cy.wait('@remover');
    cy.get('#item-10').should('not.exist');
    cy.contains('Use a busca abaixo para adicionar alimentos ao seu prato').should('be.visible');
  });

  it('exibe a analise do guia automaticamente quando a refeicao ja possui itens e analise', () => {
    const refeicaoConfirmada = {
      ...refeicaoBase,
      total_itens: 1,
      itens: [
        {
          alimento_id: 10,
          nome: 'Arroz Integral',
          grupo: 'Cereais',
          classificacao_guia: 'in natura',
          categoria_guia: '',
          sazonalidade_atual: { valor: 4, texto: 'Em safra', nivel: 'alta' },
        },
      ],
      analise: {
        classificacao: 'parcial',
        mensagem: 'Sua refeição está parcialmente adequada.',
        checklist: [
          { id: 'base-in-natura', label: 'Base em alimentos in natura', obrigatorio: true, dica: 'Adicione mais itens naturais', cumprido: true },
          { id: 'evitar-ultraprocessado', label: 'Sem ultraprocessados', obrigatorio: true, dica: 'Remova itens ultraprocessados', cumprido: false },
        ],
        obrigatorios_cumpridos: 1,
        obrigatorios_total: 2,
      },
    };

    cy.intercept('GET', '**/api/refeicoes/1**', { statusCode: 200, body: refeicaoConfirmada }).as('obter');
    cy.visitAutenticado('/prato/1');
    cy.wait('@obter');

    cy.contains('Sua refeição está parcialmente adequada.').should('be.visible');
    cy.contains('1/2 critérios obrigatórios').should('be.visible');
    cy.get('#btn-confirmar-escolha').should('not.exist');
  });

  it('volta para /prato ao clicar no botao de voltar', () => {
    cy.intercept('GET', '**/api/refeicoes/1**', { statusCode: 200, body: refeicaoBase }).as('obter');
    cy.visitAutenticado('/prato/1');
    cy.wait('@obter');

    cy.get('#btn-voltar-detalhe').click();
    cy.url().should('include', '/prato');
    cy.url().should('not.include', '/prato/1');
  });
});
