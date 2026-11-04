import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthStore } from '../../services/auth.store';
import { LibraryService } from '../../services/library.service';
import { GameShelfComponent, ShelfItem } from '../game-shelf/game-shelf.component';

@Component({
  selector: 'app-welcome-strip',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, GameShelfComponent],
  template: `
    @if (!authStore.isLoggedIn()) {
      <div class="welcome-strip">
        <p class="welcome-pitch">Track what you play. Review what you finish.</p>
        <div class="welcome-actions">
          <a mat-button routerLink="/register" class="btn-primary">Sign up</a>
          <a mat-button routerLink="/login" class="btn-secondary">Log in</a>
        </div>
      </div>
    } @else if (playingItems().length > 0) {
      <div class="currently-playing-section">
        <app-game-shelf
          title="Currently playing"
          kicker="Your library"
          [items]="playingItems()"
        ></app-game-shelf>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .welcome-strip {
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      background-color: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 24px;
      margin-bottom: 48px;
    }

    @media (min-width: 768px) {
      .welcome-strip {
        flex-direction: row;
        gap: 24px;
        padding: 18px 32px;
      }
    }

    .welcome-pitch {
      font-size: 1.05rem;
      font-weight: 500;
      color: var(--text);
      margin: 0;
      text-align: center;
      letter-spacing: -0.01em;
    }

    @media (min-width: 768px) {
      .welcome-pitch {
        text-align: left;
      }
    }

    .welcome-actions {
      display: flex;
      align-items: center;
      gap: 12px;

      .btn-primary {
        background-color: var(--text) !important;
        color: var(--bg) !important;
        border-radius: var(--radius-pill) !important;
        text-transform: uppercase;
        font-weight: 600;
        font-size: 13px !important;
        letter-spacing: 0.08em;
        padding: 0 20px !important;
        height: 38px !important;
      }

      .btn-secondary {
        border: 1px solid rgba(242, 243, 245, 0.4) !important;
        border-radius: var(--radius-pill) !important;
        color: var(--text) !important;
        text-transform: uppercase;
        font-size: 13px !important;
        letter-spacing: 0.08em;
        padding: 0 20px !important;
        height: 38px !important;
      }
    }

    .currently-playing-section {
      margin-bottom: 48px;
    }
  `],
})
export class WelcomeStripComponent {
  readonly authStore = inject(AuthStore);
  private readonly libraryService = inject(LibraryService);

  readonly playingResource = this.libraryService.getPlaying(() =>
    this.authStore.user()?.username
  );

  readonly playingItems = computed<ShelfItem[]>(() => {
    if (!this.authStore.isLoggedIn()) return [];
    const entries = this.playingResource.value();
    if (!entries || !Array.isArray(entries)) return [];
    return entries.map((entry) => ({
      game: entry.game,
      caption: 'Playing',
    }));
  });
}
