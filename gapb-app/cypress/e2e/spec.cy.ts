describe('Smoke test', () => {
  it('Carrega a aplicacao', () => {
    cy.visit('/')
    cy.get('.phone-wrapper').should('exist')
  })
})
