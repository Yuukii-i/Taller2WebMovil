import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HomeService } from '../services/home.service';
import { StateViewComponent } from '../components/state-view.component';
import { RankedShelfComponent } from '../components/ranked-shelf/ranked-shelf.component';
import { ReviewCardComponent } from '../components/review-card/review-card.component';
import { GameShelfComponent, ShelfItem } from '../components/game-shelf/game-shelf.component';
import { GenreTilesComponent } from '../components/genre-tiles/genre-tiles.component';
import { CompactListComponent } from '../components/compact-list/compact-list.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    StateViewComponent,
    RankedShelfComponent,
    ReviewCardComponent,
    GameShelfComponent,
    GenreTilesComponent,
    CompactListComponent,
  ],
  template: `
    <div class="home-container">
      <!-- HERO & WELCOME STRIP SLOT (Reserved for F2b) -->
      <div class="hero-slot" aria-hidden="true"></div>

      <app-state-view
        [loading]="homeResource.isLoading()"
        [error]="homeErrorMessage()"
        [empty]="isPageEmpty()"
        emptyMessage="No games or reviews yet. Check back soon!"
        (retry)="reload()"
      >
        @if (homeData(); as data) {
          <div class="home-sections">
            <!-- 3. Top rated shelf -->
            @if (data.top_rated.length > 0) {
              <app-ranked-shelf
                title="Top rated"
                kicker="Best reviewed"
                [items]="data.top_rated"
              ></app-ranked-shelf>
            }

            <!-- 4. Recent reviews -->
            @if (data.recent_reviews.length > 0) {
              <section class="home-section">
                <div class="section-header">
                  <span class="section-kicker">Community</span>
                  <h2 class="section-title">Recent reviews</h2>
                </div>
                <div class="reviews-grid">
                  @for (rev of data.recent_reviews; track rev.id) {
                    <app-review-card [review]="rev"></app-review-card>
                  }
                </div>
              </section>
            }

            <!-- 5. Most wishlisted -->
            @if (data.most_wishlisted.length > 0) {
              <app-game-shelf
                title="Most wishlisted"
                kicker="Anticipated"
                [items]="wishlistItems()"
              ></app-game-shelf>
            }

            <!-- 6. Most played right now -->
            @if (data.most_playing.length > 0) {
              <app-game-shelf
                title="Most played right now"
                kicker="Trending"
                [items]="playingItems()"
              ></app-game-shelf>
            }

            <!-- 7. Browse by genre -->
            @if (genres().length > 0) {
              <section class="home-section">
                <div class="section-header">
                  <span class="section-kicker">Categories</span>
                  <h2 class="section-title">Browse by genre</h2>
                </div>
                <app-genre-tiles [genres]="genres()"></app-genre-tiles>
              </section>
            }

            <!-- 8. Finished vs. Abandoned -->
            @if (data.most_completed.length > 0 || data.most_abandoned.length > 0) {
              <section class="home-section">
                <div class="section-header">
                  <span class="section-kicker">Stats</span>
                  <h2 class="section-title">Finished vs. Abandoned</h2>
                </div>
                <div class="side-by-side-grid">
                  <app-compact-list
                    title="Most completed"
                    [items]="data.most_completed"
                  ></app-compact-list>
                  <app-compact-list
                    title="Most abandoned"
                    [items]="data.most_abandoned"
                  ></app-compact-list>
                </div>
              </section>
            }
          </div>
        }
      </app-state-view>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .home-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }
    @media (min-width: 768px) {
      .home-container {
        padding: 32px 40px 80px;
      }
    }
    .hero-slot {
      display: none;
    }
    .home-sections {
      display: flex;
      flex-direction: column;
      gap: 56px;
    }
    .home-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .section-kicker {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 14px;
      color: var(--accent);
      letter-spacing: 0.02em;
    }
    .section-title {
      font-family: 'Inter', sans-serif;
      font-size: 1.35rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
      letter-spacing: -0.01em;
    }
    .reviews-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    @media (min-width: 768px) {
      .reviews-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .side-by-side-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 768px) {
      .side-by-side-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `],
})
export class HomePageComponent {
  private readonly homeService = inject(HomeService);

  readonly homeResource = this.homeService.home();
  readonly genresResource = this.homeService.genres();

  readonly homeData = computed(() => this.homeResource.value());
  readonly genres = computed(() => this.genresResource.value() || []);

  readonly homeErrorMessage = computed(() => {
    const err = this.homeResource.error();
    if (!err) return null;
    return typeof err === 'string' ? err : 'Failed to load home feed. Please try again.';
  });

  readonly isPageEmpty = computed(() => {
    const data = this.homeData();
    if (!data) return false;
    return (
      (data.top_rated?.length || 0) === 0 &&
      (data.recent_reviews?.length || 0) === 0 &&
      (data.most_wishlisted?.length || 0) === 0 &&
      (data.most_playing?.length || 0) === 0 &&
      (data.most_completed?.length || 0) === 0 &&
      (data.most_abandoned?.length || 0) === 0 &&
      this.genres().length === 0
    );
  });

  readonly wishlistItems = computed<ShelfItem[]>(() => {
    const items = this.homeData()?.most_wishlisted || [];
    return items.map((i) => ({
      game: i.game,
      caption: `${i.count} ${i.count === 1 ? 'wishlist' : 'wishlists'}`,
    }));
  });

  readonly playingItems = computed<ShelfItem[]>(() => {
    const items = this.homeData()?.most_playing || [];
    return items.map((i) => ({
      game: i.game,
      caption: `${i.count} playing`,
    }));
  });

  reload(): void {
    this.homeResource.reload();
    this.genresResource.reload();
  }
}
