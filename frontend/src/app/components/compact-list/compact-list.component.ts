import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameCountItem } from '../../models';

@Component({
  selector: 'app-compact-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="compact-card">
      <h3 class="list-title">{{ title() }}</h3>
      <ol class="ranked-list">
        @for (item of items(); track item.game.id; let idx = $index) {
          <li class="ranked-row">
            <span class="rank-num">{{ idx + 1 }}</span>
            <a [routerLink]="['/games', item.game.id]" class="row-link">
              <div class="thumb-container">
                @if (item.game.cover_url) {
                  <img [src]="item.game.cover_url" [alt]="item.game.title" class="thumb-img" loading="lazy" />
                } @else {
                  <div class="thumb-placeholder">{{ item.game.title[0] || '?' }}</div>
                }
              </div>
              <div class="row-info">
                <span class="game-title" [title]="item.game.title">{{ item.game.title }}</span>
                <span class="game-genres">{{ genresLine(item.game) }}</span>
              </div>
            </a>
            <span class="count-tag">{{ item.count }}</span>
          </li>
        } @empty {
          <li class="empty-row">No games yet</li>
        }
      </ol>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .compact-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .list-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 16px;
      letter-spacing: -0.01em;
    }
    .ranked-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ranked-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .ranked-row:last-child {
      border-bottom: none;
    }
    .rank-num {
      width: 20px;
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-align: right;
      flex-shrink: 0;
    }
    .row-link {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
      flex: 1 1 auto;
      min-width: 0;
    }
    .row-link:hover .game-title {
      color: var(--accent);
    }
    .thumb-container {
      width: 36px;
      height: 48px;
      border-radius: 4px;
      overflow: hidden;
      background: var(--surface-2);
      flex-shrink: 0;
    }
    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .row-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .game-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 150ms ease;
    }
    .game-genres {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .count-tag {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--surface-2);
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      flex-shrink: 0;
    }
    .empty-row {
      color: var(--text-muted);
      font-size: 13px;
      padding: 12px 0;
      text-align: center;
    }
  `],
})
export class CompactListComponent {
  readonly title = input.required<string>();
  readonly items = input<GameCountItem[]>([]);

  genresLine(game: any): string {
    return (game?.genres || []).map((g: any) => g.name).join(' · ');
  }
}
