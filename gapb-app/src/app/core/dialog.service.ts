import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DialogState {
  tipo: 'alert' | 'confirm';
  mensagem: string;
  titulo?: string;
  resolve: (valor: boolean) => void;
}

/** Substitui window.alert()/confirm() pelo modal já usado no resto do app. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private stateSubject = new BehaviorSubject<DialogState | null>(null);
  state$ = this.stateSubject.asObservable();

  confirm(mensagem: string, titulo?: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.stateSubject.next({ tipo: 'confirm', mensagem, titulo, resolve });
    });
  }

  alert(mensagem: string, titulo?: string): Promise<void> {
    return new Promise((resolve) => {
      this.stateSubject.next({ tipo: 'alert', mensagem, titulo, resolve: () => resolve() });
    });
  }

  responder(valor: boolean) {
    const atual = this.stateSubject.value;
    if (!atual) return;
    this.stateSubject.next(null);
    atual.resolve(valor);
  }
}
