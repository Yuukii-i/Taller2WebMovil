import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { ReviewDetailPageComponent } from './review-detail-page.component';
import { ReviewsService } from '../services/reviews.service';
import { CommentsService } from '../services/comments.service';
import { AuthStore } from '../services/auth.store';
import { CommentOut, Page, ReviewWithGame } from '../models';

describe('ReviewDetailPageComponent - Permissions & State', () => {
  let mockAuthStore: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
  };
  let mockReviewsService: {
    detail: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockCommentsService: {
    list: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const createMockReview = (authorId = 1): ReviewWithGame => ({
    id: 10,
    game_id: 42,
    score: 9,
    body: 'Incredible game from start to finish.',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    author: { id: authorId, username: 'review_author' },
    comment_count: 1,
    game: {
      id: 42,
      title: 'Chrono Trigger',
      slug: 'chrono-trigger',
      cover_url: 'https://example.com/ct.jpg',
      release_date: '1995-03-11',
      platforms: ['SNES'],
      genres: [{ name: 'RPG', slug: 'rpg' }],
      avg_score: 9.8,
      review_count: 120,
    },
  });

  const createMockCommentsPage = (commentAuthorId = 2): Page<CommentOut> => ({
    items: [
      {
        id: 101,
        review_id: 10,
        body: 'Totally agree with you!',
        created_at: '2026-01-03T00:00:00Z',
        author: { id: commentAuthorId, username: 'comment_author' },
      },
    ],
    total: 1,
    page: 1,
    page_size: 20,
  });

  const setupTest = async (
    currentUserId: number | null,
    reviewAuthorId = 1,
    commentAuthorId = 2,
    hasReviewError = false
  ) => {
    TestBed.resetTestingModule();

    mockAuthStore = {
      isLoggedIn: vi.fn().mockReturnValue(currentUserId !== null),
      user: vi.fn().mockReturnValue(
        currentUserId !== null ? { id: currentUserId, username: `user_${currentUserId}` } : null
      ),
    };

    const reviewSignal = signal<ReviewWithGame | null>(
      hasReviewError ? null : createMockReview(reviewAuthorId)
    );
    const reviewLoadingSignal = signal<boolean>(false);
    const reviewErrorSignal = signal<any>(hasReviewError ? { status: 404 } : null);

    mockReviewsService = {
      detail: vi.fn().mockReturnValue({
        value: reviewSignal,
        isLoading: reviewLoadingSignal,
        error: reviewErrorSignal,
        reload: vi.fn(),
      }),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    const commentsSignal = signal<Page<CommentOut> | null>(
      hasReviewError ? null : createMockCommentsPage(commentAuthorId)
    );
    const commentsLoadingSignal = signal<boolean>(false);
    const commentsErrorSignal = signal<any>(null);

    mockCommentsService = {
      list: vi.fn().mockReturnValue({
        value: commentsSignal,
        isLoading: commentsLoadingSignal,
        error: commentsErrorSignal,
        reload: vi.fn(),
      }),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    mockDialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined) }) };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ReviewDetailPageComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: CommentsService, useValue: mockCommentsService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReviewDetailPageComponent);
    fixture.componentRef.setInput('id', '10');
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance };
  };

  it('shows delete comment icon when logged in user is the comment author', async () => {
    const { fixture } = await setupTest(2, 1, 2);

    const deleteCommentBtn = fixture.nativeElement.querySelector('.delete-comment-btn');
    expect(deleteCommentBtn).toBeTruthy();
  });

  it('shows delete comment icon when logged in user is the review author', async () => {
    const { fixture } = await setupTest(1, 1, 2);

    const deleteCommentBtn = fixture.nativeElement.querySelector('.delete-comment-btn');
    expect(deleteCommentBtn).toBeTruthy();
  });

  it('hides delete comment icon when logged in user is a third user (neither comment nor review author)', async () => {
    const { fixture } = await setupTest(99, 1, 2);

    const deleteCommentBtn = fixture.nativeElement.querySelector('.delete-comment-btn');
    expect(deleteCommentBtn).toBeNull();
  });

  it('shows Edit and Delete buttons for review owner', async () => {
    const { fixture } = await setupTest(1, 1, 2);

    const editReviewBtn = fixture.nativeElement.querySelector('.edit-review-btn');
    const deleteReviewBtn = fixture.nativeElement.querySelector('.delete-review-btn');
    expect(editReviewBtn).toBeTruthy();
    expect(deleteReviewBtn).toBeTruthy();
  });

  it('hides Edit and Delete buttons for third user', async () => {
    const { fixture } = await setupTest(99, 1, 2);

    const editReviewBtn = fixture.nativeElement.querySelector('.edit-review-btn');
    const deleteReviewBtn = fixture.nativeElement.querySelector('.delete-review-btn');
    expect(editReviewBtn).toBeNull();
    expect(deleteReviewBtn).toBeNull();
  });

  it('renders Review not found state on error', async () => {
    const { fixture } = await setupTest(null, 1, 2, true);

    const errorView = fixture.nativeElement.querySelector('.page-state-wrapper');
    expect(errorView.textContent).toContain('Review not found');

    const homeLink = fixture.nativeElement.querySelector('.browse-link');
    expect(homeLink).toBeTruthy();
  });
});
