// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';

// O app usa @zxing/ngx-scanner (leitura de codigo de barras via camera).
// O Cypress nao tem acesso a uma camera real, entao getUserMedia e stubado
// globalmente para nao travar specs que passem por telas com o scanner.
Cypress.on('window:before:load', (win) => {
  if (win.navigator.mediaDevices) {
    cy.stub(win.navigator.mediaDevices, 'getUserMedia').resolves(new MediaStream());
  }
});
