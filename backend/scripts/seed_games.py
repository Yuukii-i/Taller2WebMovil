import argparse
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.db import SessionLocal
from app.services.game_import import upsert_games
from app.services.rawg import RawgError, list_popular


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed popular games from RAWG")
    parser.add_argument("--pages", type=int, default=8, help="Number of pages to import (40 games per page)")
    args = parser.parse_args()

    if not settings.rawg_api_key:
        print("Error: RAWG_API_KEY is not configured", file=sys.stderr)
        sys.exit(1)

    total_imported = 0
    with SessionLocal() as db:
        for p in range(1, args.pages + 1):
            try:
                results = list_popular(page=p, page_size=40)
            except RawgError as e:
                if p == 1:
                    print(f"Error: Failed to fetch page 1 from RAWG: {e}", file=sys.stderr)
                    sys.exit(1)
                else:
                    print(f"Warning: Failed to fetch page {p} from RAWG: {e}", file=sys.stderr)
                    break

            upserted = upsert_games(db, results)
            total_imported += len(upserted)

    print(f"imported/updated {total_imported} games")


if __name__ == "__main__":
    main()
