import { Routes } from '@angular/router';
import { EscanearComponent } from './escanear/pag-escaneamento';
import { ResultadoComponent } from './resultado-escaneamento/resultado-escaneamento';
import { TelaInicial } from './tela-inicial/tela-inicial';
import { GuiaComponent } from './guia/guia';
import { CapituloComponent } from './guia/capitulo/capitulo';
import { LoginComponent } from './login/login';
import { RegistroComponent } from './registro/registro';
import { PratoComponent } from './prato/prato';
import { PratoDetalheComponent } from './prato/prato-detalhe/prato-detalhe';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },

  // Rotas protegidas por autenticação
  { path: 'home', component: TelaInicial, canActivate: [authGuard] },
  { path: 'escanear', component: EscanearComponent, canActivate: [authGuard] },
  { path: 'resultado', component: ResultadoComponent, canActivate: [authGuard] },
  { path: 'guia', component: GuiaComponent, canActivate: [authGuard] },
  { path: 'guia/capitulo', component: CapituloComponent, canActivate: [authGuard] },
  { path: 'prato', component: PratoComponent, canActivate: [authGuard] },
  { path: 'prato/:id', component: PratoDetalheComponent, canActivate: [authGuard] },

  { path: '**', redirectTo: 'home' },
];
