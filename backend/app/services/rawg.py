import httpx

from app.config import settings

RAWG_BASE_URL = "https://api.rawg.io/api"
RAWG_TIMEOUT = 8.0


class RawgError(Exception):
    pass


def _get_client() -> httpx.Client:
    return httpx.Client(base_url=RAWG_BASE_URL, timeout=RAWG_TIMEOUT)


def search_games(q: str, page_size: int = 20) -> list[dict]:
    if not settings.rawg_api_key:
        raise RawgError("RAWG API key is not configured")
    try:
        with _get_client() as client:
            resp = client.get(
                "/games",
                params={
                    "key": settings.rawg_api_key,
                    "search": q,
                    "page_size": page_size,
                    "page": 1,
                    "ordering": "-added",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", [])
    except Exception as e:
        raise RawgError("RAWG search failed") from e


def list_popular(page: int, page_size: int = 40) -> list[dict]:
    if not settings.rawg_api_key:
        raise RawgError("RAWG API key is not configured")
    try:
        with _get_client() as client:
            resp = client.get(
                "/games",
                params={
                    "key": settings.rawg_api_key,
                    "page": page,
                    "page_size": page_size,
                    "ordering": "-added",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", [])
    except Exception as e:
        raise RawgError("RAWG list popular failed") from e


def get_game(rawg_id: int) -> dict:
    if not settings.rawg_api_key:
        raise RawgError("RAWG API key is not configured")
    try:
        with _get_client() as client:
            resp = client.get(
                f"/games/{rawg_id}",
                params={"key": settings.rawg_api_key},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        raise RawgError("RAWG get game failed") from e
