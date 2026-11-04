import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule, MatPaginatorModule],
  template: `
    <div class="pager-wrapper">
      <mat-paginator
        [length]="total()"
        [pageSize]="pageSize()"
        [pageIndex]="page() - 1"
        [pageSizeOptions]="[10, 20, 50]"
        (page)="onPageEvent($event)"
        aria-label="Select page"
      ></mat-paginator>
    </div>
  `,
  styles: [`
    .pager-wrapper {
      display: flex;
      justify-content: center;
      padding: 16px 0;
    }
    mat-paginator {
      background: transparent;
      color: var(--text-muted);
    }
  `],
})
export class PagerComponent {
  readonly total = input<number>(0);
  readonly page = input<number>(1);
  readonly pageSize = input<number>(20);
  readonly pageChange = output<{ page: number; pageSize: number }>();

  onPageEvent(e: PageEvent): void {
    this.pageChange.emit({
      page: e.pageIndex + 1,
      pageSize: e.pageSize,
    });
  }
}
