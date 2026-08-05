import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  email = '';
  senha = '';
  erro: string | null = null;
  carregando = false;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    this.erro = null;
    if (!this.email || !this.senha) {
      this.erro = 'Preencha todos os campos.';
      return;
    }
    this.carregando = true;
    this.auth.login(this.email, this.senha).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err) => {
        this.erro = err.error?.error || 'Erro ao fazer login. Tente novamente.';
        this.carregando = false;
      },
    });
  }
}
