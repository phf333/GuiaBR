import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class RegistroComponent {
  nome = '';
  email = '';
  senha = '';
  confirmarSenha = '';
  erro: string | null = null;
  carregando = false;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    this.erro = null;
    if (!this.nome || !this.email || !this.senha || !this.confirmarSenha) {
      this.erro = 'Preencha todos os campos.';
      return;
    }
    if (this.senha !== this.confirmarSenha) {
      this.erro = 'As senhas não coincidem.';
      return;
    }
    if (this.senha.length < 6) {
      this.erro = 'A senha deve ter pelo menos 6 caracteres.';
      return;
    }
    this.carregando = true;
    this.auth.register(this.nome, this.email, this.senha).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err) => {
        this.erro = err.error?.error || 'Erro ao criar conta. Tente novamente.';
        this.carregando = false;
      },
    });
  }
}
