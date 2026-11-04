import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { AuthStore } from '../../services/auth.store';
import { CommentsService } from '../../services/comments.service';
import { CommentOut } from '../../models';

@Component({
  selector: 'app-comment-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    @if (isAuthenticated()) {
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="comment-form-box">
        @if (serverError()) {
          <div class="server-error" role="alert">
            <mat-icon class="err-icon">error_outline</mat-icon>
            <span>{{ serverError() }}</span>
          </div>
        }

        <mat-form-field appearance="outline" class="body-field">
          <mat-label>Add a comment</mat-label>
          <textarea
            matInput
            [formControl]="form.controls.body"
            rows="3"
            placeholder="Share your thoughts on this review..."
          ></textarea>
          <mat-hint align="end" [class.hint-overflow]="(form.controls.body.value || '').length > 1000">
            {{ (form.controls.body.value || '').length }} / 1000
          </mat-hint>
          @if (form.controls.body.touched && form.controls.body.hasError('required')) {
            <mat-error>Comment cannot be empty</mat-error>
          }
          @if (form.controls.body.hasError('maxlength')) {
            <mat-error>Comment must not exceed 1000 characters</mat-error>
          }
        </mat-form-field>

        <div class="actions-row">
          <button
            mat-flat-button
            type="submit"
            class="submit-comment-btn"
            [disabled]="form.invalid || saving() || !hasValidText()"
          >
            @if (saving()) {
              <mat-spinner diameter="16" class="inline-spinner"></mat-spinner>
              <span>Posting...</span>
            } @else {
              <span>Post Comment</span>
            }
          </button>
        </div>
      </form>
    } @else {
      <div class="login-prompt-wrapper">
        <a
          mat-button
          class="login-prompt-btn"
          [routerLink]="['/login']"
          [queryParams]="{ returnUrl: currentUrl() }"
        >
          Log in to comment
        </a>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      margin: 16px 0 24px;
    }
    .comment-form-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .body-field {
      width: 100%;
    }
    .hint-overflow {
      color: var(--danger) !important;
    }
    .server-error {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(229, 72, 77, 0.12);
      border: 1px solid var(--danger);
      border-radius: var(--radius);
      padding: 8px 12px;
      color: var(--danger);
      font-size: 13px;
      margin-bottom: 8px;
    }
    .err-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .actions-row {
      display: flex;
      justify-content: flex-end;
    }
    .submit-comment-btn {
      background-color: var(--text) !important;
      color: var(--bg) !important;
      border-radius: var(--radius-pill) !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      padding: 0 20px !important;
      height: 38px !important;
      line-height: 38px !important;

      &:disabled {
        opacity: 0.5 !important;
      }
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 6px;
    }
    .login-prompt-wrapper {
      padding: 16px 0;
    }
    .login-prompt-btn {
      border: 1px solid var(--border) !important;
      border-radius: var(--radius-pill) !important;
      color: var(--text) !important;
      background: var(--surface) !important;
      padding: 0 20px !important;
      height: 38px !important;
      line-height: 38px !important;

      &:hover {
        background: var(--surface-2) !important;
      }
    }
  `],
})
export class CommentFormComponent {
  readonly reviewId = input.required<number>();
  readonly commentSubmitted = output<CommentOut>();

  private readonly authStore = inject(AuthStore);
  private readonly commentsService = inject(CommentsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.authStore.isLoggedIn());
  readonly currentUrl = computed(() => this.router.url);

  readonly form = new FormGroup({
    body: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
  });

  readonly hasValidText = computed(() => {
    const val = this.form.controls.body.value;
    return Boolean(val && val.trim().length > 0);
  });

  onSubmit(): void {
    const text = this.form.controls.body.value.trim();
    if (!text || this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.serverError.set(null);

    this.commentsService.create(this.reviewId(), { body: text }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.form.reset({ body: '' });
        this.form.markAsPristine();
        this.form.markAsUntouched();
        this.snackBar.open('Comment posted', 'Close', { duration: 3000 });
        this.commentSubmitted.emit(created);
      },
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(err.error?.detail || 'Failed to post comment');
      },
    });
  }
}
