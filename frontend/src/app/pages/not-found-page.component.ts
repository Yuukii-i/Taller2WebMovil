import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  template: `
    <div class="not-found-container">
      <h1 class="code">404</h1>
      <p class="msg">Page not found</p>
      <a mat-stroked-button routerLink="/">Return home</a>
    </div>
  `,
  styles: [`
    .not-found-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 160px);
      text-align: center;
      gap: 16px;
    }
    .code {
      font-size: 72px;
      margin: 0;
      color: var(--text-muted);
      font-weight: 800;
    }
    .msg {
      margin: 0 0 16px;
      font-size: 18px;
      color: var(--text);
    }
  `],
})
export class NotFoundPageComponent {}
