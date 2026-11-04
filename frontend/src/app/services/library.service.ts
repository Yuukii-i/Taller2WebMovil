import { Injectable, inject } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { LibraryEntry, LibraryStatus, UserLibraryItem } from '../models';

@Injectable({
  providedIn: 'root',
})
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getPlaying(usernameFn: () => string | null | undefined) {
    return httpResource<UserLibraryItem[]>(() => {
      const u = usernameFn();
      if (!u) return undefined;
      return `${this.baseUrl}/users/${encodeURIComponent(u)}/library?status=playing`;
    });
  }

  set(gameId: number, status: LibraryStatus): Observable<LibraryEntry> {
    return this.http.put<LibraryEntry>(`${this.baseUrl}/library/${gameId}`, {
      status,
    });
  }

  remove(gameId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/library/${gameId}`);
  }
}
