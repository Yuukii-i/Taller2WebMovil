import {
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { UsersService } from '../services/users.service';
import { AuthStore } from '../services/auth.store';
import { GameCardComponent } from '../components/game-card.component';
import { ReviewCardComponent } from '../components/review-card/review-card.component';
import { StateViewComponent } from '../components/state-view.component';
import { PagerComponent } from '../components/pager.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    GameCardComponent,
    ReviewCardComponent,
    StateViewComponent,
    PagerComponent,
    DatePipe,
  ],
  template: `
    @if (profileResource.isLoading()) {
      <div class="page-state-wrapper">
        <app-state-view [loading]="true"></app-state-view>
      </div>
    } @else if (profileResource.error()) {
      <div class="page-state-wrapper">
        <app-state-view [error]="'User not found'"></app-state-view>
        <div class="error-actions">
          <a mat-button class="browse-link" routerLink="/games">Browse Games</a>
        </div>
      </div>
    } @else if (user(); as u) {
      <div class="profile-container">
        <!-- Profile Header -->
        <header class="profile-header">
          <div class="avatar-ph">{{ u.username[0] || '?' }}</div>
          <div class="profile-info">
            <div class="name-badge-row">
              <h1 class="profile-username">&#64;{{ u.username }}</h1>
              @if (isCurrentUser()) {
                <span class="is-you-badge">This is you</span>
              }
            </div>

            <div class="profile-meta">
              <span class="meta-item">Joined {{ u.created_at | date:'MMMM yyyy' }}</span>
              <span class="meta-dot">·</span>
              <span class="meta-item">
                {{ u.review_count }} {{ u.review_count === 1 ? 'review' : 'reviews' }}
              </span>
            </div>
          </div>
        </header>

        <!-- Navigation Tabs -->
        <nav class="profile-tabs-bar" role="tablist" aria-label="User profile sections">
          <button
            type="button"
            role="tab"
            class="profile-tab"
            [class.active]="currentTab() === 'wishlist'"
            [attr.aria-selected]="currentTab() === 'wishlist'"
            (click)="selectTab('wishlist')"
          >
            Wishlist ({{ u.library_counts.wishlist }})
          </button>
          <button
            type="button"
            role="tab"
            class="profile-tab"
            [class.active]="currentTab() === 'playing'"
            [attr.aria-selected]="currentTab() === 'playing'"
            (click)="selectTab('playing')"
          >
            Playing ({{ u.library_counts.playing }})
          </button>
          <button
            type="button"
            role="tab"
            class="profile-tab"
            [class.active]="currentTab() === 'completed'"
            [attr.aria-selected]="currentTab() === 'completed'"
            (click)="selectTab('completed')"
          >
            Completed ({{ u.library_counts.completed }})
          </button>
          <button
            type="button"
            role="tab"
            class="profile-tab"
            [class.active]="currentTab() === 'abandoned'"
            [attr.aria-selected]="currentTab() === 'abandoned'"
            (click)="selectTab('abandoned')"
          >
            Abandoned ({{ u.library_counts.abandoned }})
          </button>
          <button
            type="button"
            role="tab"
            class="profile-tab"
            [class.active]="currentTab() === 'reviews'"
            [attr.aria-selected]="currentTab() === 'reviews'"
            (click)="selectTab('reviews')"
          >
            Reviews ({{ u.review_count }})
          </button>
        </nav>

        <!-- Tab Content -->
        <main class="tab-content-area">
          @if (currentTab() === 'reviews') {
            <!-- Reviews Tab -->
            @if (reviewsResource.isLoading()) {
              <app-state-view [loading]="true"></app-state-view>
            } @else if (reviewsResource.error()) {
              <app-state-view
                [error]="'Failed to load reviews'"
                (retry)="reviewsResource.reload()"
              ></app-state-view>
            } @else if (reviewsPage(); as rp) {
              @if (rp.items.length === 0) {
                <app-state-view [empty]="true" emptyMessage="Nothing here yet"></app-state-view>
              } @else {
                <div class="reviews-grid">
                  @for (rev of rp.items; track rev.id) {
                    <app-review-card [review]="rev"></app-review-card>
                  }
                </div>

                @if (rp.total > pageSize()) {
                  <app-pager
                    [total]="rp.total"
                    [page]="page()"
                    [pageSize]="pageSize()"
                    (pageChange)="onPageChange($event)"
                  ></app-pager>
                }
              }
            }
          } @else {
            <!-- Library Tabs (wishlist / playing / completed / abandoned) -->
            @if (libraryResource.isLoading()) {
              <app-state-view [loading]="true"></app-state-view>
            } @else if (libraryResource.error()) {
              <app-state-view
                [error]="'Failed to load library'"
                (retry)="libraryResource.reload()"
              ></app-state-view>
            } @else if (libraryPage(); as lp) {
              @if (lp.items.length === 0) {
                <app-state-view [empty]="true" emptyMessage="Nothing here yet"></app-state-view>
              } @else {
                <div class="games-grid">
                  @for (item of lp.items; track item.game.id) {
                    <app-game-card [game]="item.game"></app-game-card>
                  }
                </div>

                @if (lp.total > pageSize()) {
                  <app-pager
                    [total]="lp.total"
                    [page]="page()"
                    [pageSize]="pageSize()"
                    (pageChange)="onPageChange($event)"
                  ></app-pager>
                }
              }
            }
          }
        </main>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      color: var(--text);
    }
    .page-state-wrapper {
      padding: 80px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .error-actions {
      margin-top: 16px;
    }
    .browse-link {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius-pill) !important;
      color: var(--text) !important;
    }
    .profile-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }
    @media (min-width: 768px) {
      .profile-container {
        padding: 56px 40px 80px;
      }
    }

    /* Header */
    .profile-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-bottom: 32px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 28px;
    }
    .avatar-ph {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--surface-2);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: var(--text);
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .profile-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .name-badge-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .profile-username {
      font-size: 26px;
      font-weight: 800;
      margin: 0;
      color: var(--text);
    }
    .is-you-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 3px 10px;
      background: rgba(242, 193, 78, 0.12);
      color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: var(--radius-pill);
    }
    .profile-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--text-muted);
    }
    .meta-dot {
      color: rgba(255, 255, 255, 0.2);
    }

    /* Tabs */
    .profile-tabs-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 16px;
      margin-bottom: 32px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .profile-tab {
      background: transparent;
      border: 1px solid transparent;
      outline: none;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 600;
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      white-space: nowrap;
      transition: all 150ms ease;

      &:hover:not(.active) {
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
      }

      &.active {
        background: var(--text);
        color: var(--bg);
        font-weight: 700;
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }

    /* Grid layouts */
    .games-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (min-width: 600px) {
      .games-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    @media (min-width: 900px) {
      .games-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 24px;
      }
    }
    @media (min-width: 1100px) {
      .games-grid {
        grid-template-columns: repeat(5, 1fr);
      }
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
  `],
})
export class ProfilePageComponent {
  readonly username = input<string>();

  private readonly usersService = inject(UsersService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly pageSize = signal<number>(20);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly currentTab = computed(() => {
    const t = this.queryParams()?.get('tab')?.toLowerCase();
    if (t && ['wishlist', 'playing', 'completed', 'abandoned', 'reviews'].includes(t)) {
      return t;
    }
    return 'wishlist';
  });

  readonly page = computed(() => {
    const p = Number(this.queryParams()?.get('page'));
    return p > 0 ? p : 1;
  });

  readonly isCurrentUser = computed(() => {
    const myUsername = this.authStore.user()?.username?.toLowerCase();
    const targetUsername = this.username()?.toLowerCase();
    return Boolean(myUsername && targetUsername && myUsername === targetUsername);
  });

  readonly profileResource = this.usersService.profile(() => this.username());
  readonly user = computed(() => this.profileResource.value() ?? null);

  readonly libraryResource = this.usersService.library(
    () => this.username(),
    () => (this.currentTab() !== 'reviews' ? this.currentTab() : null),
    () => this.page(),
    () => this.pageSize()
  );
  readonly libraryPage = computed(() => this.libraryResource.value() ?? null);

  readonly reviewsResource = this.usersService.reviews(
    () => this.username(),
    () => (this.currentTab() === 'reviews' ? this.page() : 1),
    () => this.pageSize()
  );
  readonly reviewsPage = computed(() => this.reviewsResource.value() ?? null);

  selectTab(tab: string): void {
    this.router.navigate([], {
      queryParams: { tab, page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.router.navigate([], {
      queryParams: { page: event.page },
      queryParamsHandling: 'merge',
    });
  }
}
