from datetime import date
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.game import Game, Genre
from app.services.rawg import RawgError, get_game


def _parse_release_date(raw_date: Any) -> date | None:
    if not raw_date or not isinstance(raw_date, str):
        return None
    try:
        return date.fromisoformat(raw_date.strip())
    except (ValueError, TypeError):
        return None


def upsert_games(db: Session, rawg_results: list[dict]) -> list[Game]:
    if not rawg_results:
        return []

    # Preload existing genres by slug
    all_genre_slugs = {
        g["slug"].strip()
        for r in rawg_results
        for g in r.get("genres", [])
        if g.get("slug")
    }
    existing_genres_query = select(Genre).where(Genre.slug.in_(all_genre_slugs))
    genres_by_slug = {g.slug: g for g in db.scalars(existing_genres_query).all()}

    # Create missing genres
    for r in rawg_results:
        for g_data in r.get("genres", []):
            slug = g_data.get("slug")
            name = g_data.get("name")
            if slug and slug not in genres_by_slug and name:
                new_genre = Genre(name=name, slug=slug)
                db.add(new_genre)
                genres_by_slug[slug] = new_genre
    db.flush()

    # Preload existing games by rawg_id
    rawg_ids = [r["id"] for r in rawg_results if r.get("id") is not None]
    existing_games = db.scalars(select(Game).where(Game.rawg_id.in_(rawg_ids))).all()
    games_by_rawg_id = {g.rawg_id: g for g in existing_games}

    result_games: list[Game] = []

    for r in rawg_results:
        r_id = r.get("id")
        if r_id is None:
            continue

        raw_slug = r.get("slug") or f"game-{r_id}"
        title = r.get("name") or raw_slug
        bg_image = r.get("background_image")
        rating = r.get("rating")
        rawg_rating = float(rating) if rating is not None else None
        release_date = _parse_release_date(r.get("released"))

        platforms_data = r.get("platforms")
        platforms: list[str] = []
        if isinstance(platforms_data, list):
            for p in platforms_data:
                if isinstance(p, dict):
                    plat_info = p.get("platform")
                    if isinstance(plat_info, dict) and plat_info.get("name"):
                        platforms.append(plat_info["name"])

        # Determine target genres
        target_genres: list[Genre] = []
        seen_genre_ids = set()
        for g_data in r.get("genres", []):
            slug = g_data.get("slug")
            if slug and slug in genres_by_slug:
                genre_obj = genres_by_slug[slug]
                if genre_obj.slug not in seen_genre_ids:
                    seen_genre_ids.add(genre_obj.slug)
                    target_genres.append(genre_obj)

        if r_id in games_by_rawg_id:
            game = games_by_rawg_id[r_id]
            game.slug = raw_slug
            game.title = title
            game.cover_url = bg_image
            game.background_url = bg_image
            game.release_date = release_date
            game.platforms = platforms
            game.rawg_rating = rawg_rating
            game.genres = target_genres
        else:
            game = Game(
                rawg_id=r_id,
                slug=raw_slug,
                title=title,
                cover_url=bg_image,
                background_url=bg_image,
                release_date=release_date,
                platforms=platforms,
                rawg_rating=rawg_rating,
                genres=target_genres,
            )
            db.add(game)
            games_by_rawg_id[r_id] = game

        result_games.append(game)

    db.commit()
    return result_games


def ensure_description(db: Session, game: Game) -> None:
    if game.description is not None or game.rawg_id is None:
        return
    try:
        detail = get_game(game.rawg_id)
        desc = detail.get("description_raw") or detail.get("description")
        if desc:
            game.description = desc
            db.commit()
    except RawgError:
        pass
