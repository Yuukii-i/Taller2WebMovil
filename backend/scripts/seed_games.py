import argparse
import sys
import time
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.db import SessionLocal
from app.services.game_import import upsert_games
from app.services.igdb import IgdbError, list_popular


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed popular games from IGDB")
    parser.add_argument("--pages", type=int, default=6, help="Number of pages to import (50 games per page)")
    args = parser.parse_args()

    if not settings.igdb_client_id or not settings.igdb_client_secret:
        print("Error: IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be configured", file=sys.stderr)
        sys.exit(1)

    total_imported = 0
    with SessionLocal() as db:
        for p in range(1, args.pages + 1):
            if p > 1:
                time.sleep(0.35)

            try:
                results = list_popular(page=p, page_size=50)
            except IgdbError as e:
                if p == 1:
                    print(f"Error: Failed to fetch page 1 from IGDB: {e}", file=sys.stderr)
                    sys.exit(1)
                else:
                    print(f"Warning: Failed to fetch page {p} from IGDB: {e}", file=sys.stderr)
                    break

            upserted = upsert_games(db, results)
            total_imported += len(upserted)

    print(f"imported/updated {total_imported} games")


if __name__ == "__main__":
    main()
