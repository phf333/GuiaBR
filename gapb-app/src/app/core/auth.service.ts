import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { LocalDbService } from './local-db.service';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
}

interface AuthResponse {
  access_token: string;
  usuario: Usuario;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = environment.apiUrl;
  private readonly TOKEN_KEY = 'guiabr_token';
  private readonly USUARIO_KEY = 'guiabr_usuario';

  // BehaviorSubject reativo com os dados do usuário atual
  usuarioAtual$ = new BehaviorSubject<Usuario | null>(this._carregarUsuarioSalvo());

  // Dono dos dados guardados no aparelho (cache e fila offline). Sobrevive ao logout
  // por sessão expirada, para que o mesmo usuário recupere a fila ao logar de novo.
  private readonly DONO_KEY = 'guiabr_dono_dados';
  private readonly PREFIXO_CHAVES = 'guiabr_';

  /** Resolve quando a limpeza de dados locais em andamento (se houver) termina. */
  limpezaLocal: Promise<void> = Promise.resolve();

  constructor(private http: HttpClient, private router: Router, private localDb: LocalDbService) {
    const usuario = this.usuarioAtual$.value;
    if (usuario && !localStorage.getItem(this.DONO_KEY)) {
      localStorage.setItem(this.DONO_KEY, String(usuario.id));
    }
  }

  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  login(email: string, senha: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/login`, { email, senha })
      .pipe(tap(res => this._salvarSessao(res)));
  }

  register(nome: string, email: string, senha: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/register`, { nome, email, senha })
      .pipe(tap(res => this._salvarSessao(res)));
  }

  /**
   * Encerra a sessão. Por padrão apaga também os dados do usuário guardados no aparelho;
   * com `preservarDadosLocais` (sessão expirada) eles ficam para o próximo login do mesmo usuário.
   */
  logout(preservarDadosLocais = false): void {
    if (preservarDadosLocais) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USUARIO_KEY);
    } else {
      this._limparDadosLocais();
    }
    this.usuarioAtual$.next(null);
    this.router.navigate(['/login']);
  }

  private _salvarSessao(res: AuthResponse): void {
    const dono = localStorage.getItem(this.DONO_KEY);
    if (dono && dono !== String(res.usuario.id)) {
      this._limparDadosLocais();
    }
    localStorage.setItem(this.TOKEN_KEY, res.access_token);
    localStorage.setItem(this.USUARIO_KEY, JSON.stringify(res.usuario));
    localStorage.setItem(this.DONO_KEY, String(res.usuario.id));
    this.usuarioAtual$.next(res.usuario);
  }

  private _limparDadosLocais(): void {
    Object.keys(localStorage)
      .filter(chave => chave.startsWith(this.PREFIXO_CHAVES))
      .forEach(chave => localStorage.removeItem(chave));
    this.limpezaLocal = this.localDb.clearUserData()
      .catch(err => console.error('Erro ao limpar dados locais do usuário:', err));
  }

  private _carregarUsuarioSalvo(): Usuario | null {
    try {
      const raw = localStorage.getItem(this.USUARIO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
