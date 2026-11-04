import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthStore } from '../../services/auth.store';
import { LibraryService } from '../../services/library.service';
import { LibraryStatus } from '../../models';

export interface StatusOption {
  value: LibraryStatus;
  label: string;
}

@Component({
  selector: 'app-status-select',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule],
  template: `
    @if (isAuthenticated()) {
      <div class="segmented-control" role="group" aria-label="Library status">
        @for (opt of statuses; track opt.value) {
          <button
            type="button"
            class="segment-btn"
            [class.active]="current() === opt.value"
            [disabled]="saving()"
            (click)="onSelect(opt.value)"
          >
            {{ opt.label }}
          </button>
        }
      </div>
    } @else {
      <div class="logged-out-box">
        <a
          mat-button
          class="login-btn"
          [routerLink]="['/login']"
          [queryParams]="{ returnUrl: currentUrl() }"
        >
          Log in to track this game
        </a>
      </div>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .segmented-control {
      display: inline-flex;
      align-items: center;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      padding: 4px;
      gap: 4px;
    }
    .segment-btn {
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: background-color 150ms ease, color 150ms ease;

      &:hover:not(:disabled) {
        color: var(--text);
        background: rgba(255, 255, 255, 0.06);
      }

      &.active {
        background: var(--text);
        color: var(--bg);
        font-weight: 700;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }
    .logged-out-box {
      display: inline-flex;
      align-items: center;
    }
    .login-btn {
      color: var(--text) !important;
      border: 1px solid var(--border) !important;
      border-radius: var(--radius-pill) !important;
      font-size: 13px !important;
      letter-spacing: 0.04em;
      padding: 0 20px !important;
      height: 38px !important;
      line-height: 38px !important;
      background: var(--surface) !important;

      &:hover {
        background: var(--surface-2) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
    }
  `],
})
export class StatusSelectComponent {
  readonly gameId = input.required<number>();
  readonly current = input<string | null>(null);
  readonly changed = output<string | null>();

  private readonly authStore = inject(AuthStore);
  private readonly libraryService = inject(LibraryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly isAuthenticated = computed(() => this.authStore.isLoggedIn());
  readonly currentUrl = computed(() => this.router.url);

  readonly statuses: StatusOption[] = [
    { value: 'wishlist', label: 'Wishlist' },
    { value: 'playing', label: 'Playing' },
    { value: 'completed', label: 'Completed' },
    { value: 'abandoned', label: 'Abandoned' },
  ];

  onSelect(status: LibraryStatus): void {
    if (this.saving()) return;

    if (this.current() === status) {
      // Deselect -> remove
      this.saving.set(true);
      this.libraryService.remove(this.gameId()).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackBar.open('Removed from your library', 'Close', { duration: 3000 });
          this.changed.emit(null);
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open('Failed to update library status', 'Close', { duration: 3000 });
        },
      });
    } else {
      // Set new status
      this.saving.set(true);
      this.libraryService.set(this.gameId(), status).subscribe({
        next: () => {
          this.saving.set(false);
          const msg = status === 'wishlist' ? 'Added to Wishlist' : `Marked as ${status.charAt(0).toUpperCase() + status.slice(1)}`;
          this.snackBar.open(msg, 'Close', { duration: 3000 });
          this.changed.emit(status);
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open('Failed to update library status', 'Close', { duration: 3000 });
        },
      });
    }
  }
}
