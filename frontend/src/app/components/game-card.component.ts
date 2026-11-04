import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameCard } from '../models';
import { ScoreBadgeComponent } from './score-badge.component';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [CommonModule, RouterModule, ScoreBadgeComponent],
  template: `
    @if (game(); as g) {
      <a [routerLink]="['/games', g.id]" class="card-link">
        <div class="poster-container">
          @if (g.cover_url) {
            <img [src]="g.cover_url" [alt]="g.title" class="poster-img" loading="lazy" />
          } @else {
            <div class="poster-placeholder">
              <span class="initials">{{ initials() }}</span>
            </div>
          }
          <div class="badge-overlay">
            <app-score-badge [score]="g.avg_score"></app-score-badge>
          </div>
        </div>
        <div class="info">
          <h4 class="title" [title]="g.title">{{ g.title }}</h4>
          <p class="genres">{{ genresLine() }}</p>
        </div>
      </a>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .card-link {
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      transition: transform 150ms ease, box-shadow 150ms ease;
      border-radius: var(--radius);
      overflow: hidden;
    }
    .card-link:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.7);
    }
    .poster-container {
      position: relative;
      width: 100%;
      aspect-ratio: 3 / 4;
      background: var(--surface-2);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .poster-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .poster-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-2);
      color: var(--text-muted);
    }
    .initials {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .badge-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
    }
    .info {
      padding: 10px 2px 4px;
    }
    .title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--text);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .genres {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class GameCardComponent {
  readonly game = input<GameCard | null>(null);

  readonly initials = computed(() => {
    const title = this.game()?.title || '';
    return title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('');
  });

  readonly genresLine = computed(() => {
    const genres = this.game()?.genres || [];
    return genres.map((g) => g.name).join(' · ');
  });
}
