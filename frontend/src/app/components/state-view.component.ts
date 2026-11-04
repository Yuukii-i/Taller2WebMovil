import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-state-view',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule],
  template: `
    @if (loading()) {
      <div class="state-container loading">
        <mat-spinner diameter="44"></mat-spinner>
      </div>
    } @else if (error()) {
      <div class="state-container error">
        <mat-icon class="error-icon">error_outline</mat-icon>
        <p class="error-message">{{ error() }}</p>
        <button mat-button class="retry-btn" (click)="retry.emit()">Retry</button>
      </div>
    } @else if (empty()) {
      <div class="state-container empty">
        <mat-icon class="empty-icon">inbox</mat-icon>
        <p class="empty-message">{{ emptyMessage() }}</p>
      </div>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [`
    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      gap: 16px;
      min-height: 200px;
      text-align: center;
      color: var(--text-muted);
    }
    .error-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--danger);
    }
    .error-message {
      color: var(--danger);
      margin: 0;
      font-size: 15px;
    }
    .retry-btn {
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.08em;
    }
    .empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      opacity: 0.5;
    }
    .empty-message {
      margin: 0;
      font-size: 15px;
    }
  `],
})
export class StateViewComponent {
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly empty = input<boolean>(false);
  readonly emptyMessage = input<string>('No items found');
  readonly retry = output<void>();
}
