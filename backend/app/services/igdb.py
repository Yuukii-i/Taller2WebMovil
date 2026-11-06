import threading
import time
from typing import Any
import httpx

from app.config import settings

IGDB_BASE_URL = "https://api.igdb.com/v4"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)

FIELDS = "name,slug,summary,first_release_date,total_rating,total_rating_count,cover.image_id,screenshots.image_id,artworks.image_id,genres.name,genres.slug,platforms.name"

_custom_transport: httpx.BaseTransport | None = None


class IgdbError(Exception):
    pass


class IgdbTokenManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    def invalidate(self) -> None:
        with self._lock:
            self._access_token = None
            self._expires_at = 0.0

    def get_token(self) -> str:
        now = time.monotonic()
        with self._lock:
            if self._access_token and now < (self._expires_at - 60):
                return self._access_token

        if not settings.igdb_client_id or not settings.igdb_client_secret:
            raise IgdbError("IGDB credentials are not configured")

        with _get_client() as client:
            try:
                resp = client.post(
                    TWITCH_TOKEN_URL,
                    params={
                        "client_id": settings.igdb_client_id,
                        "client_secret": settings.igdb_client_secret,
                        "grant_type": "client_credentials",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                token = data.get("access_token")
                expires_in = data.get("expires_in", 3600)
                if not token:
                    raise IgdbError("Missing access_token in Twitch response")
            except IgdbError:
                raise
            except Exception as e:
                raise IgdbError(f"Twitch OAuth request failed: {type(e).__name__}") from e

        with self._lock:
            self._access_token = token
            self._expires_at = time.monotonic() + float(expires_in)
            return self._access_token


token_manager = IgdbTokenManager()


def _get_client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT, transport=_custom_transport)


def escape_query_string(q: str) -> str:
    return q.replace("\\", "\\\\").replace('"', '\\"')


def _request(query: str) -> list[dict[str, Any]]:
    if not settings.igdb_client_id or not settings.igdb_client_secret:
        raise IgdbError("IGDB credentials are not configured")

    token = token_manager.get_token()

    def do_post(tok: str) -> httpx.Response:
        headers = {
            "Client-ID": settings.igdb_client_id,
            "Authorization": f"Bearer {tok}",
        }
        with _get_client() as client:
            return client.post(
                f"{IGDB_BASE_URL}/games",
                headers=headers,
                content=query.encode("utf-8"),
            )

    try:
        resp = do_post(token)
        if resp.status_code == 401:
            token_manager.invalidate()
            fresh_token = token_manager.get_token()
            resp = do_post(fresh_token)

        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list):
            raise IgdbError(f"Unexpected IGDB response format: {type(data).__name__}")
        return data
    except IgdbError:
        raise
    except Exception as e:
        raise IgdbError(f"IGDB request failed: {type(e).__name__}") from e


def search_games(q: str, page_size: int = 20) -> list[dict[str, Any]]:
    escaped_q = escape_query_string(q)
    query = (
        f'search "{escaped_q}";\n'
        f'fields {FIELDS};\n'
        f'where cover != null & game_type = (0,8,9,10,11);\n'
        f'limit {page_size};'
    )
    return _request(query)


def list_popular(page: int = 1, page_size: int = 50) -> list[dict[str, Any]]:
    offset = max(0, (page - 1) * page_size)
    query = (
        f'fields {FIELDS};\n'
        f'where total_rating_count > 20 & cover != null & game_type = (0,8,9,10,11);\n'
        f'sort total_rating_count desc;\n'
        f'limit {page_size};\n'
        f'offset {offset};'
    )
    return _request(query)


def build_cover_url(image_id: str | None) -> str | None:
    if not image_id:
        return None
    return f"https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"


def build_background_url(record: dict[str, Any]) -> str | None:
    screenshots = record.get("screenshots") or []
    if isinstance(screenshots, list):
        for ss in screenshots:
            if isinstance(ss, dict) and ss.get("image_id"):
                return f"https://images.igdb.com/igdb/image/upload/t_1080p/{ss['image_id']}.jpg"

    artworks = record.get("artworks") or []
    if isinstance(artworks, list):
        for art in artworks:
            if isinstance(art, dict) and art.get("image_id"):
                return f"https://images.igdb.com/igdb/image/upload/t_1080p/{art['image_id']}.jpg"

    cover = record.get("cover")
    if isinstance(cover, dict) and cover.get("image_id"):
        return f"https://images.igdb.com/igdb/image/upload/t_1080p/{cover['image_id']}.jpg"

    return None
