import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-nav-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-header.html',
  styleUrl: './nav-header.scss'
})
export class NavHeaderComponent {
  @Input() title = '';
  @Output() back = new EventEmitter<void>();

  onBack() {
    this.back.emit();
  }
}
