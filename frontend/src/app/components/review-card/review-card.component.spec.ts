import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReviewCardComponent } from './review-card.component';
import { ReviewWithGame } from '../../models';

describe('ReviewCardComponent', () => {
  const baseReview: ReviewWithGame = {
    id: 1,
    game_id: 10,
    score: 9,
    body: 'Short review text',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    author: {
      id: 2,
      username: 'reviewer1',
    },
    comment_count: 3,
    game: {
      id: 10,
      title: 'Chrono Trigger',
      slug: 'chrono-trigger',
      cover_url: null,
      release_date: '1995-03-11',
      platforms: ['SNES'],
      genres: [{ name: 'RPG', slug: 'rpg' }],
      avg_score: 9.5,
      review_count: 50,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('keeps excerpt unchanged when length <= 200 chars', () => {
    const fixture = TestBed.createComponent(ReviewCardComponent);
    fixture.componentRef.setInput('review', baseReview);
    fixture.detectChanges();

    expect(fixture.componentInstance.excerpt()).toBe('Short review text');
  });

  it('truncates excerpt to <= 200 chars and adds ellipsis when body > 200 chars', () => {
    const longText = 'A'.repeat(250);
    const reviewWithLongBody: ReviewWithGame = {
      ...baseReview,
      body: longText,
    };

    const fixture = TestBed.createComponent(ReviewCardComponent);
    fixture.componentRef.setInput('review', reviewWithLongBody);
    fixture.detectChanges();

    const excerpt = fixture.componentInstance.excerpt();
    expect(excerpt.length).toBeLessThanOrEqual(200);
    expect(excerpt.endsWith('...')).toBe(true);
    expect(excerpt.length).toBe(200);
    expect(excerpt).toBe('A'.repeat(197) + '...');
  });

  it('returns empty string when review body is null or empty', () => {
    const reviewWithoutBody: ReviewWithGame = {
      ...baseReview,
      body: null,
    };

    const fixture = TestBed.createComponent(ReviewCardComponent);
    fixture.componentRef.setInput('review', reviewWithoutBody);
    fixture.detectChanges();

    expect(fixture.componentInstance.excerpt()).toBe('');
  });
});
