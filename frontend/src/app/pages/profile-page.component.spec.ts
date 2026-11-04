import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';

import { ProfilePageComponent } from './profile-page.component';
import { UsersService } from '../services/users.service';
import { AuthStore } from '../services/auth.store';
import { Page, ReviewWithGame, UserLibraryItem, UserPublic } from '../models';

describe('ProfilePageComponent - Tab and Page Query Param Mapping', () => {
  let mockAuthStore: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
  };
  let mockUsersService: {
    profile: ReturnType<typeof vi.fn>;
    library: ReturnType<typeof vi.fn>;
    reviews: ReturnType<typeof vi.fn>;
  };

  const queryParamsSubject = new BehaviorSubject(convertToParamMap({}));

  const createMockUser = (username = 'gamer_pro'): UserPublic => ({
    id: 1,
    username,
    created_at: '2025-05-10T00:00:00Z',
    review_count: 8,
    library_counts: {
      wishlist: 12,
      playing: 3,
      completed: 20,
      abandoned: 1,
    },
  });

  const setupTest = async (
    targetUsername = 'gamer_pro',
    currentUsername: string | null = 'gamer_pro',
    initialParams: Record<string, string> = {},
    hasUserError = false
  ) => {
    TestBed.resetTestingModule();
    queryParamsSubject.next(convertToParamMap(initialParams));

    mockAuthStore = {
      isLoggedIn: vi.fn().mockReturnValue(currentUsername !== null),
      user: vi.fn().mockReturnValue(
        currentUsername ? { id: 1, username: currentUsername } : null
      ),
    };

    const profileSignal = signal<UserPublic | null>(
      hasUserError ? null : createMockUser(targetUsername)
    );
    const profileLoadingSignal = signal<boolean>(false);
    const profileErrorSignal = signal<any>(hasUserError ? { status: 404 } : null);

    const librarySignal = signal<Page<UserLibraryItem> | null>({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });
    const reviewsSignal = signal<Page<ReviewWithGame> | null>({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });

    mockUsersService = {
      profile: vi.fn().mockReturnValue({
        value: profileSignal,
        isLoading: profileLoadingSignal,
        error: profileErrorSignal,
        reload: vi.fn(),
      }),
      library: vi.fn().mockReturnValue({
        value: librarySignal,
        isLoading: signal(false),
        error: signal(null),
        reload: vi.fn(),
      }),
      reviews: vi.fn().mockReturnValue({
        value: reviewsSignal,
        isLoading: signal(false),
        error: signal(null),
        reload: vi.fn(),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamsSubject.asObservable(),
          },
        },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.componentRef.setInput('username', targetUsername);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance };
  };

  it('maps default query params to tab "wishlist" and page 1', async () => {
    const { component } = await setupTest('gamer_pro', 'gamer_pro', {});

    expect(component.currentTab()).toBe('wishlist');
    expect(component.page()).toBe(1);
    expect(component.isCurrentUser()).toBe(true);
  });

  it('restores state when query params ?tab=completed&page=2 are provided', async () => {
    const { component } = await setupTest('gamer_pro', 'gamer_pro', {
      tab: 'completed',
      page: '2',
    });

    expect(component.currentTab()).toBe('completed');
    expect(component.page()).toBe(2);
  });

  it('navigates with updated query params on tab click', async () => {
    const { component } = await setupTest('gamer_pro', 'gamer_pro', {});
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    component.selectTab('completed');

    expect(navSpy).toHaveBeenCalledWith([], {
      queryParams: { tab: 'completed', page: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('navigates with updated page on pager event', async () => {
    const { component } = await setupTest('gamer_pro', 'gamer_pro', { tab: 'completed' });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    component.onPageChange({ page: 3, pageSize: 20 });

    expect(navSpy).toHaveBeenCalledWith([], {
      queryParams: { page: 3 },
      queryParamsHandling: 'merge',
    });
  });

  it('renders "This is you" badge when viewing own profile', async () => {
    const { fixture } = await setupTest('gamer_pro', 'gamer_pro');
    const badge = fixture.nativeElement.querySelector('.is-you-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('This is you');
  });

  it('does not render "This is you" badge when viewing someone else profile', async () => {
    const { fixture } = await setupTest('gamer_pro', 'different_user');
    const badge = fixture.nativeElement.querySelector('.is-you-badge');
    expect(badge).toBeNull();
  });

  it('renders "User not found" state on error', async () => {
    const { fixture } = await setupTest('ghost_user', null, {}, true);

    const errorView = fixture.nativeElement.querySelector('.page-state-wrapper');
    expect(errorView.textContent).toContain('User not found');
  });
});
