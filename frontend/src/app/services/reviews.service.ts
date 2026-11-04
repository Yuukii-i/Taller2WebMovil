import { Injectable, inject } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Page, ReviewIn, ReviewOut, ReviewWithGame } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ReviewsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  forGame(
    gameIdFn: () => number | string | null | undefined,
    sortFn: () => string | null | undefined = () => 'latest',
    pageFn: () => number | null | undefined = () => 1,
    pageSizeFn: () => number | null | undefined = () => 20
  ) {
    return httpResource<Page<ReviewOut>>(() => {
      const id = gameIdFn();
      if (!id) return undefined;

      const sort = sortFn() || 'latest';
      const page = pageFn() || 1;
      const pageSize = pageSizeFn() || 20;

      const searchParams = new URLSearchParams();
      searchParams.set('sort', sort);
      searchParams.set('page', String(page));
      searchParams.set('page_size', String(pageSize));

      return `${this.baseUrl}/games/${id}/reviews?${searchParams.toString()}`;
    });
  }

  detail(idFn: () => number | string | null | undefined) {
    return httpResource<ReviewWithGame>(() => {
      const id = idFn();
      if (!id) return undefined;
      return `${this.baseUrl}/reviews/${id}`;
    });
  }

  getOne(id: number): Observable<ReviewWithGame> {
    return this.http.get<ReviewWithGame>(`${this.baseUrl}/reviews/${id}`);
  }

  create(gameId: number, body: ReviewIn): Observable<ReviewOut> {
    return this.http.post<ReviewOut>(`${this.baseUrl}/games/${gameId}/reviews`, body);
  }

  update(id: number, body: ReviewIn): Observable<ReviewOut> {
    return this.http.put<ReviewOut>(`${this.baseUrl}/reviews/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/reviews/${id}`);
  }
}
