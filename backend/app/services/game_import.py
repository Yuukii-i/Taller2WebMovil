from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.game import Game, Genre
from app.services.igdb import build_background_url, build_cover_url


def _parse_release_date(ts: Any) -> Any:
    if ts is None:
        return None
    try:
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc).date()
    except (ValueError, OSError, OverflowError, TypeError):
        return None
    return None


def upsert_games(db: Session, igdb_results: list[dict[str, Any]]) -> list[Game]:
    if not igdb_results:
        return []

    # Preload existing genres by slug
    all_genre_slugs = {
        g["slug"].strip()
        for r in igdb_results
        for g in r.get("genres", [])
        if isinstance(g, dict) and g.get("slug")
    }
    existing_genres_query = select(Genre).where(Genre.slug.in_(all_genre_slugs))
    genres_by_slug = {g.slug: g for g in db.scalars(existing_genres_query).all()}

    # Create missing genres
    for r in igdb_results:
        for g_data in r.get("genres", []):
            if isinstance(g_data, dict):
                slug = g_data.get("slug")
                name = g_data.get("name")
                if slug and slug not in genres_by_slug and name:
                    new_genre = Genre(name=name, slug=slug)
                    db.add(new_genre)
                    genres_by_slug[slug] = new_genre
    db.flush()

    # Preload existing games by igdb_id
    igdb_ids = [r["id"] for r in igdb_results if r.get("id") is not None]
    existing_games = db.scalars(select(Game).where(Game.igdb_id.in_(igdb_ids))).all()
    games_by_igdb_id = {g.igdb_id: g for g in existing_games}

    result_games: list[Game] = []

    for r in igdb_results:
        r_id = r.get("id")
        if r_id is None:
            continue

        raw_slug = r.get("slug") or f"game-{r_id}"
        title = r.get("name") or raw_slug

        cover_img_id = None
        if isinstance(r.get("cover"), dict):
            cover_img_id = r["cover"].get("image_id")
        cover_url = build_cover_url(cover_img_id)
        background_url = build_background_url(r)

        description = r.get("summary")
        release_date = _parse_release_date(r.get("first_release_date"))

        rating = r.get("total_rating")
        igdb_rating = float(rating) if rating is not None else None

        platforms_data = r.get("platforms")
        platforms: list[str] = []
        if isinstance(platforms_data, list):
            for p in platforms_data:
                if isinstance(p, dict) and p.get("name"):
                    platforms.append(p["name"])

        # Determine target genres
        target_genres: list[Genre] = []
        seen_genre_slugs = set()
        for g_data in r.get("genres", []):
            if isinstance(g_data, dict):
                slug = g_data.get("slug")
                if slug and slug in genres_by_slug:
                    genre_obj = genres_by_slug[slug]
                    if genre_obj.slug not in seen_genre_slugs:
                        seen_genre_slugs.add(genre_obj.slug)
                        target_genres.append(genre_obj)

        if r_id in games_by_igdb_id:
            game = games_by_igdb_id[r_id]
            game.slug = raw_slug
            game.title = title
            game.cover_url = cover_url
            game.background_url = background_url
            game.description = description
            game.release_date = release_date
            game.platforms = platforms
            game.igdb_rating = igdb_rating
            game.genres = target_genres
        else:
            game = Game(
                igdb_id=r_id,
                slug=raw_slug,
                title=title,
                cover_url=cover_url,
                background_url=background_url,
                description=description,
                release_date=release_date,
                platforms=platforms,
                igdb_rating=igdb_rating,
                genres=target_genres,
            )
            db.add(game)
            games_by_igdb_id[r_id] = game

        result_games.append(game)

    db.commit()
    return result_games
