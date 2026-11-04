import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { CommentFormComponent } from './comment-form.component';
import { AuthStore } from '../../services/auth.store';
import { CommentsService } from '../../services/comments.service';
import { CommentOut } from '../../models';

describe('CommentFormComponent', () => {
  let mockAuthStore: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
  };
  let mockCommentsService: {
    create: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const setupTest = async (isLoggedIn = true) => {
    mockAuthStore = {
      isLoggedIn: vi.fn().mockReturnValue(isLoggedIn),
      user: vi.fn().mockReturnValue(isLoggedIn ? { id: 1, username: 'tester' } : null),
    };
    mockCommentsService = {
      create: vi.fn().mockReturnValue(
        of({
          id: 10,
          review_id: 5,
          body: 'Great take!',
          created_at: '2026-01-01T00:00:00Z',
          author: { id: 1, username: 'tester' },
        } as CommentOut)
      ),
    };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommentFormComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: CommentsService, useValue: mockCommentsService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommentFormComponent);
    fixture.componentRef.setInput('reviewId', 5);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance };
  };

  it('validates empty body and body > 1000 characters', async () => {
    const { fixture, component } = await setupTest();

    expect(component.form.valid).toBe(false);
    expect(component.hasValidText()).toBe(false);

    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-comment-btn');
    expect(submitBtn.disabled).toBe(true);

    // Whitespace only
    component.form.controls.body.setValue('   ');
    fixture.detectChanges();
    expect(component.hasValidText()).toBe(false);
    expect(submitBtn.disabled).toBe(true);

    // Exceeds 1000 chars
    component.form.controls.body.setValue('x'.repeat(1001));
    component.form.controls.body.markAsDirty();
    component.form.controls.body.markAsTouched();
    fixture.detectChanges();
    expect(component.form.controls.body.hasError('maxlength')).toBe(true);
    expect(submitBtn.disabled).toBe(true);
  });

  it('submits valid comment, resets form cleanly, and emits commentSubmitted', async () => {
    const { fixture, component } = await setupTest();

    let emitted: CommentOut | undefined;
    component.commentSubmitted.subscribe((c) => (emitted = c));

    component.form.controls.body.setValue('  Great take!  ');
    fixture.detectChanges();

    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-comment-btn');
    expect(submitBtn.disabled).toBe(false);

    component.onSubmit();
    fixture.detectChanges();

    expect(mockCommentsService.create).toHaveBeenCalledWith(5, { body: 'Great take!' });
    expect(mockSnackBar.open).toHaveBeenCalledWith('Comment posted', 'Close', expect.any(Object));
    expect(emitted?.id).toBe(10);

    // Clean reset without showing validation errors
    expect(component.form.controls.body.value).toBe('');
    expect(component.form.controls.body.untouched).toBe(true);
    expect(component.form.controls.body.pristine).toBe(true);
  });

  it('renders login prompt link when user is logged out', async () => {
    const { fixture } = await setupTest(false);

    const formEl = fixture.nativeElement.querySelector('form');
    expect(formEl).toBeNull();

    const loginBtn = fixture.nativeElement.querySelector('.login-prompt-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.textContent).toContain('Log in to comment');
  });
});
