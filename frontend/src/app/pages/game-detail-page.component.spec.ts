import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { GameDetailPageComponent } from './game-detail-page.component';
import { GamesService } from '../services/games.service';
import { ReviewsService } from '../services/reviews.service';
import { AuthStore } from '../services/auth.store';
import { GameDetail, Page, ReviewOut } from '../models';

describe('GameDetailPageComponent - CTA Mapping & State', () => {
  let mockAuthStore: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
  };
  let mockGamesService: {
    detail: ReturnType<typeof vi.fn>;
  };
  let mockReviewsService: {
    forGame: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const createMockGame = (my_status: string | null = null, my_review_id: number | null = null): GameDetail => ({
    id: 42,
    title: 'Super Mario 64',
    slug: 'super-mario-64',
    description: 'A revolutionary 3D platformer.',
    cover_url: 'https://example.com/cover.jpg',
    background_url: 'https://example.com/bg.jpg',
    release_date: '1996-06-23',
    platforms: ['Nintendo 64'],
    genres: [{ name: 'Platformer', slug: 'platformer' }],
    rawg_rating: 4.8,
    avg_score: 9.6,
    review_count: 50,
    status_counts: {
      wishlist: 15,
      playing: 8,
      completed: 25,
      abandoned: 2,
    },
    my_status,
    my_review_id,
  });

  const createMockReviewsPage = (): Page<ReviewOut> => ({
    items: [
      {
        id: 101,
        game_id: 42,
        score: 10,
        body: 'Masterpiece',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        author: { id: 1, username: 'testuser' },
        comment_count: 2,
      },
    ],
    total: 1,
    page: 1,
    page_size: 20,
  });

  const setupTest = async (
    gameData: GameDetail | null = createMockGame(),
    isLoggedIn = true,
    hasError = false
  ) => {
    mockAuthStore = {
      isLoggedIn: vi.fn().mockReturnValue(isLoggedIn),
      user: vi.fn().mockReturnValue(isLoggedIn ? { id: 1, username: 'testuser' } : null),
    };

    const gameValSignal = signal<GameDetail | null>(gameData);
    const gameLoadingSignal = signal<boolean>(false);
    const gameErrorSignal = signal<any>(hasError ? { status: 404 } : null);

    mockGamesService = {
      detail: vi.fn().mockReturnValue({
        value: gameValSignal,
        isLoading: gameLoadingSignal,
        error: gameErrorSignal,
        reload: vi.fn(),
      }),
    };

    const reviewsPageSignal = signal<Page<ReviewOut> | null>(createMockReviewsPage());
    const reviewsLoadingSignal = signal<boolean>(false);
    const reviewsErrorSignal = signal<any>(null);

    mockReviewsService = {
      forGame: vi.fn().mockReturnValue({
        value: reviewsPageSignal,
        isLoading: reviewsLoadingSignal,
        error: reviewsErrorSignal,
        reload: vi.fn(),
      }),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    mockDialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined) }) };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [GameDetailPageComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: GamesService, useValue: mockGamesService },
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GameDetailPageComponent);
    fixture.componentRef.setInput('id', '42');
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance };
  };

  it('maps logged out user to login prompt CTA with returnUrl', async () => {
    const { fixture } = await setupTest(createMockGame(null, null), false);

    const loginCta = fixture.nativeElement.querySelector('.login-cta');
    expect(loginCta).toBeTruthy();
    expect(loginCta.textContent).toContain('Log in to review this game');

    const writeBtn = fixture.nativeElement.querySelector('.write-cta');
    const editBtn = fixture.nativeElement.querySelector('.edit-cta');
    expect(writeBtn).toBeNull();
    expect(editBtn).toBeNull();
  });

  it('maps logged in user with my_review_id: null to Write a review CTA', async () => {
    const { fixture, component } = await setupTest(createMockGame(null, null), true);

    const writeBtn = fixture.nativeElement.querySelector('.write-cta');
    expect(writeBtn).toBeTruthy();
    expect(writeBtn.textContent).toContain('Write a review');

    const editBtn = fixture.nativeElement.querySelector('.edit-cta');
    const loginCta = fixture.nativeElement.querySelector('.login-cta');
    expect(editBtn).toBeNull();
    expect(loginCta).toBeNull();

    // Clicking Write opens dialog
    writeBtn.click();
    expect(mockDialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { gameId: 42, gameTitle: 'Super Mario 64', reviewId: null },
      })
    );
  });

  it('maps logged in user with my_review_id: 101 to Edit your review CTA and highlights own review', async () => {
    const { fixture } = await setupTest(createMockGame('completed', 101), true);

    const editBtn = fixture.nativeElement.querySelector('.edit-cta');
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent).toContain('Edit your review');

    const writeBtn = fixture.nativeElement.querySelector('.write-cta');
    expect(writeBtn).toBeNull();

    // Own review card highlighted with "Your review" badge and Edit/Delete buttons
    const ownReview = fixture.nativeElement.querySelector('.own-review');
    expect(ownReview).toBeTruthy();
    const yourReviewBadge = fixture.nativeElement.querySelector('.your-review-badge');
    expect(yourReviewBadge).toBeTruthy();
    expect(yourReviewBadge.textContent).toContain('Your review');
  });

  it('renders Game not found state on error with link to browse games', async () => {
    const { fixture } = await setupTest(null, false, true);

    const errorView = fixture.nativeElement.querySelector('.page-state-wrapper');
    expect(errorView.textContent).toContain('Game not found');

    const browseLink = fixture.nativeElement.querySelector('.browse-link');
    expect(browseLink).toBeTruthy();
  });

  it('displays correct status counts in stats row', async () => {
    const { fixture } = await setupTest(createMockGame());

    const statCards = fixture.nativeElement.querySelectorAll('.stat-card');
    expect(statCards.length).toBe(4);
    expect(statCards[0].textContent).toContain('15');
    expect(statCards[0].textContent).toContain('Wishlist');
    expect(statCards[1].textContent).toContain('8');
    expect(statCards[1].textContent).toContain('Playing');
    expect(statCards[2].textContent).toContain('25');
    expect(statCards[2].textContent).toContain('Completed');
    expect(statCards[3].textContent).toContain('2');
    expect(statCards[3].textContent).toContain('Abandoned');
  });
});
