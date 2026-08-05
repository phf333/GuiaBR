import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { DialogService, DialogState } from '../../../core/dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog.html',
})
export class DialogComponent {
  state$: Observable<DialogState | null>;

  constructor(private dialogService: DialogService) {
    this.state$ = this.dialogService.state$;
  }

  responder(valor: boolean) {
    this.dialogService.responder(valor);
  }
}
