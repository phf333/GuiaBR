// ***********************************************
// This example namespace declaration will help
// with Intellisense and code completion in your
// IDE or Text Editor.
// ***********************************************
// declare namespace Cypress {
//   interface Chainable<Subject = any> {
//     customCommand(param: any): typeof customCommand;
//   }
// }
//
// function customCommand(param: any): void {
//   console.warn(param);
// }
//
// NOTE: You can use it like so:
// Cypress.Commands.add('customCommand', customCommand);
//
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

export interface UsuarioFake {
  id: number;
  nome: string;
  email: string;
}

export const USUARIO_FAKE: UsuarioFake = {
  id: 1,
  nome: 'Usuaria Teste',
  email: 'teste@guiabr.com',
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Visita uma rota protegida já autenticada, sem passar pela tela de login. */
      visitAutenticado(url: string, usuario?: UsuarioFake): Chainable<AUTWindow>;
      /** Retorna a instância do componente Angular montado no elemento (via window.ng.getComponent). */
      ngComponent<T = any>(selector: string): Chainable<T>;
    }
  }
}

Cypress.Commands.add('visitAutenticado', (url: string, usuario: UsuarioFake = USUARIO_FAKE) => {
  return cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem('guiabr_token', 'fake-jwt-token');
      win.localStorage.setItem('guiabr_usuario', JSON.stringify(usuario));
    },
  });
});

Cypress.Commands.add('ngComponent', (selector: string) => {
  return cy.window({ log: false }).then((win: any) => {
    const el = win.document.querySelector(selector);
    if (!el) {
      throw new Error(`ngComponent: elemento não encontrado para o seletor "${selector}"`);
    }
    return win.ng.getComponent(el);
  });
});
