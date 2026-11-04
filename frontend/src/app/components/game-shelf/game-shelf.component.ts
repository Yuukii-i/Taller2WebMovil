import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameCard } from '../../models';
import { GameCardComponent } from '../game-card.component';

export interface ShelfItem {
  game: GameCard;
  caption?: string;
}

@Component({
  selector: 'app-game-shelf',
  standalone: true,
  imports: [CommonModule, GameCardComponent],
  template: `
    <section class="shelf-container">
      <div class="shelf-header">
        @if (kicker()) {
          <span class="shelf-kicker">{{ kicker() }}</span>
        }
        <h2 class="shelf-title">{{ title() }}</h2>
      </div>

      <div class="shelf-track">
        @for (item of items(); track item.game.id) {
          <div class="shelf-card">
            <app-game-card [game]="item.game"></app-game-card>
            @if (item.caption) {
              <div class="shelf-caption">{{ item.caption }}</div>
            }
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
    .shelf-card {
      flex: 0 0 170px;
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
    }
    .shelf-caption {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
      padding-left: 2px;
    }
    @media (min-width: 900px) {
      .shelf-track {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        overflow-x: visible;
        scroll-snap-type: none;
      }
      .shelf-card {
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
      .shelf-card {
        flex: none;
      }
    }
  `],
})
export class GameShelfComponent {
  readonly title = input.required<string>();
  readonly kicker = input<string | null>(null);
  readonly items = input<ShelfItem[]>([]);
}
