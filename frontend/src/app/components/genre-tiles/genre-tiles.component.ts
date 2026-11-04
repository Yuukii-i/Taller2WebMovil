import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Genre } from '../../models';

@Component({
  selector: 'app-genre-tiles',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="genre-grid">
      @for (g of topGenres(); track g.slug) {
        <a [routerLink]="['/games']" [queryParams]="{ genre: g.slug }" class="genre-tile">
          <span class="genre-name">{{ g.name }}</span>
          @if (g.game_count != null) {
            <span class="genre-count">{{ g.game_count }} games</span>
          }
        </a>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .genre-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .genre-tile {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      text-decoration: none;
      color: inherit;
      transition: background 150ms ease, transform 150ms ease, border-color 150ms ease;
    }
    .genre-tile:hover {
      background: var(--surface-2);
      border-color: rgba(255, 255, 255, 0.16);
      transform: translateY(-2px);
    }
    .genre-name {
      font-weight: 600;
      font-size: 15px;
      color: var(--text);
    }
    .genre-count {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  `],
})
export class GenreTilesComponent {
  readonly genres = input<Genre[]>([]);

  readonly topGenres = computed(() => {
    const list = [...(this.genres() || [])];
    list.sort((a, b) => (b.game_count || 0) - (a.game_count || 0));
    return list.slice(0, 12);
  });
}
