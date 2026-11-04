import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import {
  ReviewFormDialogComponent,
  ReviewFormDialogData,
} from './review-form-dialog.component';
import { ReviewsService } from '../../services/reviews.service';

describe('ReviewFormDialogComponent', () => {
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockReviewsService: {
    getOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const defaultData: ReviewFormDialogData = {
    gameId: 42,
    gameTitle: 'Super Mario 64',
    reviewId: null,
  };

  const setupTest = async (data: ReviewFormDialogData = defaultData) => {
    mockDialogRef = { close: vi.fn() };
    mockReviewsService = {
      getOne: vi.fn().mockReturnValue(of({ id: 1, game_id: 42, score: 8, body: 'Existing review' })),
      create: vi.fn().mockReturnValue(of({ id: 99, score: 9, body: 'Nice game' })),
      update: vi.fn().mockReturnValue(of({ id: 1, score: 10, body: 'Updated' })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ReviewFormDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReviewFormDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('invalid score blocks submit', async () => {
    const { fixture, component } = await setupTest();

    expect(component.form.controls.score.value).toBeNull();
    expect(component.form.valid).toBe(false);

    const submitBtn = fixture.nativeElement.querySelector('.submit-btn');
    expect(submitBtn.disabled).toBe(true);

    component.onSubmit();
    expect(mockReviewsService.create).not.toHaveBeenCalled();
  });

  it('valid submit calls create with exact payload', async () => {
    const { fixture, component } = await setupTest();

    // Select score 9
    component.setScore(9);
    component.form.controls.body.setValue('Great soundtrack and level design!');
    fixture.detectChanges();

    expect(component.form.valid).toBe(true);
    const submitBtn = fixture.nativeElement.querySelector('.submit-btn');
    expect(submitBtn.disabled).toBe(false);

    component.onSubmit();
    fixture.detectChanges();

    expect(mockReviewsService.create).toHaveBeenCalledWith(42, {
      score: 9,
      body: 'Great soundtrack and level design!',
    });
    expect(mockSnackBar.open).toHaveBeenCalledWith('Review saved', 'Close', expect.any(Object));
    expect(mockDialogRef.close).toHaveBeenCalledWith({ saved: true });
  });

  it('in edit mode prefilled review is loaded and submit calls update with exact payload', async () => {
    const editData: ReviewFormDialogData = {
      gameId: 42,
      gameTitle: 'Super Mario 64',
      reviewId: 5,
    };
    const { fixture, component } = await setupTest(editData);

    expect(mockReviewsService.getOne).toHaveBeenCalledWith(5);
    expect(component.form.controls.score.value).toBe(8);
    expect(component.form.controls.body.value).toBe('Existing review');

    // Change score to 10 and body
    component.setScore(10);
    component.form.controls.body.setValue('Updated body text');
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(mockReviewsService.update).toHaveBeenCalledWith(5, {
      score: 10,
      body: 'Updated body text',
    });
    expect(mockSnackBar.open).toHaveBeenCalledWith('Review saved', 'Close', expect.any(Object));
    expect(mockDialogRef.close).toHaveBeenCalledWith({ saved: true });
  });

  it('API 409 conflict shows inline form error', async () => {
    const { fixture, component } = await setupTest();

    mockReviewsService.create.mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: 'you already reviewed this game' } }))
    );

    component.setScore(7);
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(component.serverError()).toBe('You already reviewed this game');
    const errBox = fixture.nativeElement.querySelector('.server-error');
    expect(errBox).toBeTruthy();
    expect(errBox.textContent).toContain('You already reviewed this game');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('validates body max length of 5000', async () => {
    const { fixture, component } = await setupTest();

    component.setScore(8);
    component.form.controls.body.setValue('a'.repeat(5001));
    component.form.controls.body.markAsDirty();
    component.form.controls.body.markAsTouched();
    fixture.detectChanges();

    expect(component.form.controls.body.hasError('maxlength')).toBe(true);
    expect(component.form.valid).toBe(false);

    const submitBtn = fixture.nativeElement.querySelector('.submit-btn');
    expect(submitBtn.disabled).toBe(true);
  });
});
