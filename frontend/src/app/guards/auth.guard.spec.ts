import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../services/auth.store';
import { User } from '../models';

describe('authGuard', () => {
  let authStore: AuthStore;
  let router: Router;

  const mockUser: User = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/library' } as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), AuthStore],
    });
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('allows access when user is logged in', () => {
    authStore.setSession('test-token', mockUser);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBe(true);
  });

  it('redirects to /login?returnUrl=<target> when user is NOT logged in', () => {
    authStore.clear();

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    const expectedTree = router.createUrlTree(['/login'], {
      queryParams: { returnUrl: '/library' },
    });
    expect(result).toEqual(expectedTree);
  });
});
