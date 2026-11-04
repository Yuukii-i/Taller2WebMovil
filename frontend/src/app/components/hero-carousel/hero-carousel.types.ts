import { GameCard, Home } from '../../models';

export interface HeroSlide {
  game: GameCard;
  kicker: string;
  stat: string;
}

export function buildSlides(
  home: Home | null | undefined,
  fallbackGames?: GameCard[] | null
): HeroSlide[] {
  const slides: HeroSlide[] = [];
  const usedIds = new Set<number>();

  if (home) {
    // 1. Top rated
    const top = (home.top_rated || []).find((i) => i.game && !usedIds.has(i.game.id));
    if (top) {
      usedIds.add(top.game.id);
      const avg = top.avg_score != null ? top.avg_score.toFixed(1) : '—';
      const count = top.review_count || 0;
      slides.push({
        game: top.game,
        kicker: 'Best reviewed',
        stat: `${avg} / 10 · ${count} ${count === 1 ? 'review' : 'reviews'}`,
      });
    }

    // 2. Most wishlisted
    const wish = (home.most_wishlisted || []).find((i) => i.game && !usedIds.has(i.game.id));
    if (wish) {
      usedIds.add(wish.game.id);
      const count = wish.count || 0;
      slides.push({
        game: wish.game,
        kicker: 'Most wishlisted',
        stat: `${count} ${count === 1 ? 'wishlist' : 'wishlists'}`,
      });
    }

    // 3. Most playing
    const play = (home.most_playing || []).find((i) => i.game && !usedIds.has(i.game.id));
    if (play) {
      usedIds.add(play.game.id);
      const count = play.count || 0;
      slides.push({
        game: play.game,
        kicker: 'Played right now',
        stat: `${count} playing`,
      });
    }

    // 4. Most completed
    const comp = (home.most_completed || []).find((i) => i.game && !usedIds.has(i.game.id));
    if (comp) {
      usedIds.add(comp.game.id);
      const count = comp.count || 0;
      slides.push({
        game: comp.game,
        kicker: 'Most completed',
        stat: `${count} ${count === 1 ? 'completion' : 'completions'}`,
      });
    }

    // 5. Most abandoned
    const aban = (home.most_abandoned || []).find((i) => i.game && !usedIds.has(i.game.id));
    if (aban) {
      usedIds.add(aban.game.id);
      const count = aban.count || 0;
      slides.push({
        game: aban.game,
        kicker: 'Most abandoned',
        stat: `${count} gave up`,
      });
    }
  }

  // Fallback if no slides at all
  if (slides.length === 0 && fallbackGames && fallbackGames.length > 0) {
    const first = fallbackGames[0];
    const avg = first.avg_score != null ? `${first.avg_score.toFixed(1)} / 10` : '—';
    slides.push({
      game: first,
      kicker: 'Top pick',
      stat: avg,
    });
  }

  return slides;
}
