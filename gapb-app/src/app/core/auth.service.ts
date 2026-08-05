import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

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

  constructor(private http: HttpClient, private router: Router) {}

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

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USUARIO_KEY);
    this.usuarioAtual$.next(null);
    this.router.navigate(['/login']);
  }

  private _salvarSessao(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.access_token);
    localStorage.setItem(this.USUARIO_KEY, JSON.stringify(res.usuario));
    this.usuarioAtual$.next(res.usuario);
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
