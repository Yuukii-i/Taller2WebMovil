import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LibraryRedirectPageComponent } from './library-redirect-page.component';
import { AuthStore } from '../services/auth.store';

describe('LibraryRedirectPageComponent', () => {
  it('redirects to /u/<username>?tab=wishlist with replaceUrl when logged in', () => {
    const mockAuthStore = {
      user: vi.fn().mockReturnValue({ id: 1, username: 'player_one' }),
    };

    TestBed.configureTestingModule({
      imports: [LibraryRedirectPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
      ],
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(LibraryRedirectPageComponent);
    fixture.detectChanges();

    expect(navSpy).toHaveBeenCalledWith(['/u', 'player_one'], {
      queryParams: { tab: 'wishlist' },
      replaceUrl: true,
    });
  });

  it('redirects to /login when user is not present', () => {
    const mockAuthStore = {
      user: vi.fn().mockReturnValue(null),
    };

    TestBed.configureTestingModule({
      imports: [LibraryRedirectPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
      ],
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(LibraryRedirectPageComponent);
    fixture.detectChanges();

    expect(navSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/library' },
      replaceUrl: true,
    });
  });
});
