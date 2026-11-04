import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { StatusSelectComponent } from './status-select.component';
import { AuthStore } from '../../services/auth.store';
import { LibraryService } from '../../services/library.service';

describe('StatusSelectComponent', () => {
  let mockAuthStore: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
  };
  let mockLibraryService: {
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockAuthStore = {
      isLoggedIn: vi.fn().mockReturnValue(true),
      user: vi.fn().mockReturnValue({ id: 1, username: 'testuser' }),
    };

    mockLibraryService = {
      set: vi.fn().mockReturnValue(of({ game_id: 10, status: 'wishlist', updated_at: 'now' })),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StatusSelectComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: LibraryService, useValue: mockLibraryService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();
  });

  it('renders segmented control and calls set when selecting a new status', () => {
    const fixture = TestBed.createComponent(StatusSelectComponent);
    fixture.componentRef.setInput('gameId', 10);
    fixture.componentRef.setInput('current', null);
    fixture.detectChanges();

    let emittedStatus: string | null = undefined as any;
    fixture.componentInstance.changed.subscribe((val) => {
      emittedStatus = val;
    });

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.segment-btn');
    expect(buttons.length).toBe(4);

    // Click 'Wishlist' (first button)
    buttons[0].click();
    fixture.detectChanges();

    expect(mockLibraryService.set).toHaveBeenCalledWith(10, 'wishlist');
    expect(mockSnackBar.open).toHaveBeenCalledWith('Added to Wishlist', 'Close', expect.any(Object));
    expect(emittedStatus).toBe('wishlist');
  });

  it('calls remove when clicking the currently active status', () => {
    const fixture = TestBed.createComponent(StatusSelectComponent);
    fixture.componentRef.setInput('gameId', 10);
    fixture.componentRef.setInput('current', 'playing');
    fixture.detectChanges();

    let emittedStatus: string | null = undefined as any;
    fixture.componentInstance.changed.subscribe((val) => {
      emittedStatus = val;
    });

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.segment-btn');
    // Playing is index 1
    buttons[1].click();
    fixture.detectChanges();

    expect(mockLibraryService.remove).toHaveBeenCalledWith(10);
    expect(mockSnackBar.open).toHaveBeenCalledWith('Removed from your library', 'Close', expect.any(Object));
    expect(emittedStatus).toBeNull();
  });

  it('disables control buttons while saving', () => {
    let nextCallback: () => void = () => {};
    mockLibraryService.set.mockReturnValue({
      subscribe: (observer: any) => {
        nextCallback = observer.next;
        return { unsubscribe: () => {} };
      },
    });

    const fixture = TestBed.createComponent(StatusSelectComponent);
    fixture.componentRef.setInput('gameId', 10);
    fixture.componentRef.setInput('current', null);
    fixture.detectChanges();

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.segment-btn');
    buttons[0].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.saving()).toBe(true);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);

    // Complete saving
    nextCallback();
    fixture.detectChanges();
    expect(fixture.componentInstance.saving()).toBe(false);
  });

  it('renders logged-out prompt button with returnUrl when not authenticated', () => {
    mockAuthStore.isLoggedIn.mockReturnValue(false);

    const fixture = TestBed.createComponent(StatusSelectComponent);
    fixture.componentRef.setInput('gameId', 10);
    fixture.detectChanges();

    const segments = fixture.nativeElement.querySelector('.segmented-control');
    expect(segments).toBeNull();

    const loginBtn = fixture.nativeElement.querySelector('.login-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.textContent).toContain('Log in to track this game');
  });
});
