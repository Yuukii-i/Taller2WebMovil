import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TopRatedGameItem } from '../../models';
import { ScoreBadgeComponent } from '../score-badge.component';

@Component({
  selector: 'app-ranked-shelf',
  standalone: true,
  imports: [CommonModule, RouterModule, ScoreBadgeComponent],
  template: `
    <section class="shelf-container">
      <div class="shelf-header">
        @if (kicker()) {
          <span class="shelf-kicker">{{ kicker() }}</span>
        }
        <h2 class="shelf-title">{{ title() }}</h2>
      </div>

      <div class="shelf-track">
        @for (item of items(); track item.game.id; let idx = $index) {
          <div class="ranked-card">
            <a [routerLink]="['/games', item.game.id]" class="card-link">
              <div class="poster-container">
                @if (item.game.cover_url) {
                  <img [src]="item.game.cover_url" [alt]="item.game.title" class="poster-img" loading="lazy" />
                } @else {
                  <div class="poster-placeholder">
                    <span class="initials">{{ item.game.title[0] || '?' }}</span>
                  </div>
                }
                <span class="rank-numeral">{{ idx + 1 }}</span>
                <div class="badge-overlay">
                  <app-score-badge [score]="item.avg_score"></app-score-badge>
                </div>
              </div>
              <div class="info">
                <h4 class="title" [title]="item.game.title">{{ item.game.title }}</h4>
                <p class="caption">
                  ★ {{ item.avg_score.toFixed(1) }} · {{ item.review_count }} {{ item.review_count === 1 ? 'review' : 'reviews' }}
                </p>
              </div>
            </a>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .shelf-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .shelf-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .shelf-kicker {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 14px;
      color: var(--accent);
      letter-spacing: 0.02em;
    }
    .shelf-title {
      font-family: 'Inter', sans-serif;
      font-size: 1.35rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
      letter-spacing: -0.01em;
    }
    .shelf-track {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 8px;
      -webkit-overflow-scrolling: touch;
    }
    .ranked-card {
      flex: 0 0 170px;
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
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
      font-size: 32px;
      font-weight: 700;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .rank-numeral {
      position: absolute;
      bottom: -6px;
      left: 6px;
      font-family: 'Inter', sans-serif;
      font-size: 54px;
      font-weight: 800;
      line-height: 1;
      color: #fff;
      text-shadow: 0 3px 12px rgba(0, 0, 0, 0.9), 0 0 4px rgba(0, 0, 0, 0.8);
      z-index: 2;
      pointer-events: none;
    }
    .badge-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
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
    .caption {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--accent);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (min-width: 900px) {
      .shelf-track {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        overflow-x: visible;
        scroll-snap-type: none;
      }
      .ranked-card {
        flex: none;
      }
    }
    @media (min-width: 600px) and (max-width: 899.98px) {
      .shelf-track {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        overflow-x: visible;
        scroll-snap-type: none;
      }
      .ranked-card {
        flex: none;
      }
    }
  `],
})
export class RankedShelfComponent {
  readonly title = input.required<string>();
  readonly kicker = input<string | null>(null);
  readonly items = input<TopRatedGameItem[]>([]);
}
