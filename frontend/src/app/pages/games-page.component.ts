import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GamesService } from '../services/games.service';
import { GameCardComponent } from '../components/game-card.component';
import { PagerComponent } from '../components/pager.component';
import { StateViewComponent } from '../components/state-view.component';

@Component({
  selector: 'app-games-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    GameCardComponent,
    PagerComponent,
    StateViewComponent,
  ],
  template: `
    <div class="browse-container">
      <header class="browse-header">
        <h1 class="page-title">Browse Games</h1>
        @if (gamesPage(); as p) {
          <span class="total-count">{{ p.total }} {{ p.total === 1 ? 'game' : 'games' }}</span>
        }
      </header>

      <!-- Search and Controls Bar -->
      <div class="controls-bar">
        <div class="search-field">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="search"
            placeholder="Search games..."
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchInput($event)"
            autocomplete="off"
            aria-label="Search games"
          />
          @if (searchQuery()) {
            <button
              mat-icon-button
              type="button"
              class="clear-btn"
              (click)="clearSearch()"
              aria-label="Clear search"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>

        <div class="sort-field">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Sort by</mat-label>
            <mat-select [value]="sort()" (selectionChange)="onSortChange($event.value)">
              <mat-option value="rating">Rating</mat-option>
              <mat-option value="title">Title</mat-option>
              <mat-option value="release">Release date</mat-option>
              <mat-option value="reviews">Most reviewed</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <!-- Genre Chips Filter -->
      <div class="genre-filter-row">
        <mat-chip-listbox
          [value]="genre()"
          (change)="onGenreChange($event.value)"
          aria-label="Filter by genre"
        >
          <mat-chip-option value="">All</mat-chip-option>
          @for (g of genres(); track g.slug) {
            <mat-chip-option [value]="g.slug">{{ g.name }}</mat-chip-option>
          }
        </mat-chip-listbox>
      </div>

      <!-- State View: Loading / Error / Empty / Grid -->
      <app-state-view
        [loading]="gamesResource.isLoading() && !gamesPage()"
        [error]="errorMessage()"
        [empty]="isEmpty()"
        [emptyMessage]="emptyText()"
        (retry)="reload()"
      >
        <div class="results-wrapper">
          @if (gamesResource.isLoading() && gamesPage()) {
            <div class="refetch-spinner-overlay">
              <mat-spinner diameter="36"></mat-spinner>
            </div>
          }

          @if (gamesPage(); as p) {
            <div class="games-grid">
              @for (game of p.items; track game.id) {
                <app-game-card [game]="game"></app-game-card>
              }
            </div>

            @if (p.total > pageSize) {
              <app-pager
                [total]="p.total"
                [page]="page()"
                [pageSize]="pageSize"
                (pageChange)="onPageChange($event)"
              ></app-pager>
            }
          }
        </div>
      </app-state-view>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .browse-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }
    @media (min-width: 768px) {
      .browse-container {
        padding: 32px 40px 80px;
      }
    }
    .browse-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .page-title {
      font-size: 2rem;
      font-weight: 800;
      color: var(--text);
      margin: 0;
      letter-spacing: -0.02em;
    }
    .total-count {
      font-size: 14px;
      color: var(--text-muted);
    }
    .controls-bar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 20px;
    }
    @media (min-width: 600px) {
      .controls-bar {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .search-field {
      display: flex;
      align-items: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      padding: 4px 14px;
      flex: 1 1 300px;
      max-width: 480px;
    }
    .search-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--text-muted);
      margin-right: 8px;
    }
    .search-field input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      font-size: 14px;
      width: 100%;
    }
    .search-field input::placeholder {
      color: var(--text-muted);
    }
    .clear-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
      color: var(--text-muted);
    }
    .clear-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .sort-field {
      width: 180px;
    }
    .genre-filter-row {
      margin-bottom: 32px;
      overflow-x: auto;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;
    }
    mat-chip-listbox {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
    }
    @media (min-width: 900px) {
      mat-chip-listbox {
        flex-wrap: wrap;
      }
    }
    .results-wrapper {
      position: relative;
      min-height: 200px;
    }
    .refetch-spinner-overlay {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 10;
      background: rgba(17, 18, 20, 0.7);
      border-radius: 50%;
      padding: 4px;
    }
    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 20px;
    }
    @media (min-width: 768px) {
      .games-grid {
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 24px;
      }
    }
  `],
})
export class GamesPageComponent {
  private readonly gamesService = inject(GamesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 20;

  private readonly queryParams = toSignal(this.route.queryParams, {
    initialValue: {} as Params,
  });

  readonly q = computed(() => (this.queryParams()['q'] || '').trim());
  readonly genre = computed(() => (this.queryParams()['genre'] || '').trim());
  readonly sort = computed(() => (this.queryParams()['sort'] || 'rating').trim());
  readonly page = computed(() => {
    const p = Number(this.queryParams()['page']);
    return Number.isInteger(p) && p > 0 ? p : 1;
  });

  readonly searchQuery = signal('');
  private readonly searchSubject = new Subject<string>();

  readonly genresResource = this.gamesService.genres();
  readonly genres = computed(() => this.genresResource.value() || []);

  readonly gamesResource = this.gamesService.list(() => ({
    q: this.q(),
    genre: this.genre(),
    sort: this.sort(),
    page: this.page(),
    page_size: this.pageSize,
  }));

  readonly gamesPage = computed(() => this.gamesResource.value());

  readonly isEmpty = computed(() => {
    const p = this.gamesPage();
    return !this.gamesResource.isLoading() && !!p && p.items.length === 0;
  });

  readonly emptyText = computed(() => {
    const query = this.q();
    return query ? `No games found for “${query}”` : 'No games found';
  });

  readonly errorMessage = computed(() => {
    const err = this.gamesResource.error();
    if (!err) return null;
    return typeof err === 'string' ? err : 'Failed to load games. Please try again.';
  });

  constructor() {
    // Keep local searchQuery in sync with URL `q`
    effect(() => {
      const currentQ = this.q();
      if (currentQ !== this.searchQuery()) {
        this.searchQuery.set(currentQ);
      }
    });

    // Debounce search input and update queryParams
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((val) => {
        const trimmed = val.trim();
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            q: trimmed || null,
            page: null, // reset page to 1
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
  }

  onSearchInput(val: string): void {
    this.searchQuery.set(val);
    this.searchSubject.next(val);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  onGenreChange(newGenre: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        genre: newGenre || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  onSortChange(newSort: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort: newSort === 'rating' ? null : newSort,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: event.page > 1 ? event.page : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  reload(): void {
    this.gamesResource.reload();
  }
}
