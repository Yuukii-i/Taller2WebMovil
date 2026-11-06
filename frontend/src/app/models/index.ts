export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface LibraryCounts {
  wishlist: number;
  playing: number;
  completed: number;
  abandoned: number;
}

export interface UserPublic {
  id: number;
  username: string;
  created_at: string;
  review_count: number;
  library_counts: LibraryCounts;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterIn {
  username: string;
  email: string;
  password: string;
}

export interface LoginIn {
  identifier: string;
  password: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface GenreSimple {
  name: string;
  slug: string;
}

export interface Genre {
  id?: number | null;
  name: string;
  slug: string;
  game_count?: number | null;
}

export interface GameCard {
  id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  background_url?: string | null;
  release_date: string | null;
  platforms: string[];
  genres: GenreSimple[];
  avg_score: number | null;
  review_count: number;
}

export interface StatusCounts {
  wishlist: number;
  playing: number;
  completed: number;
  abandoned: number;
}

export interface GameDetail extends GameCard {
  description: string | null;
  background_url: string | null;
  igdb_rating: number | null;
  status_counts: StatusCounts;
  my_status: string | null;
  my_review_id: number | null;
}

export type LibraryStatus = 'wishlist' | 'playing' | 'completed' | 'abandoned';

export interface LibraryEntry {
  game_id: number;
  status: LibraryStatus;
  updated_at: string;
}

export interface UserLibraryItem {
  game: GameCard;
  status: LibraryStatus;
  updated_at: string;
}

export interface Author {
  id: number;
  username: string;
}

export interface ReviewOut {
  id: number;
  game_id: number;
  score: number;
  body: string | null;
  created_at: string;
  updated_at: string;
  author: Author;
  comment_count: number;
}

export interface ReviewWithGame extends ReviewOut {
  game: GameCard;
}

export interface ReviewIn {
  score: number;
  body: string | null;
}

export interface CommentOut {
  id: number;
  review_id: number;
  body: string;
  created_at: string;
  author: Author;
}

export interface CommentIn {
  body: string;
}

export interface GameCountItem {
  game: GameCard;
  count: number;
}

export interface TopRatedGameItem {
  game: GameCard;
  avg_score: number;
  review_count: number;
}

export interface Home {
  most_wishlisted: GameCountItem[];
  most_abandoned: GameCountItem[];
  most_playing: GameCountItem[];
  most_completed: GameCountItem[];
  top_rated: TopRatedGameItem[];
  recent_reviews: ReviewWithGame[];
}
