"""migrate from rawg to igdb

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-05 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    count = conn.execute(sa.text("SELECT COUNT(*) FROM games")).scalar()
    if count and count > 0:
        raise RuntimeError(
            "Cannot migrate games table with existing rows; reset the DB or delete games, because ids come from a different source."
        )

    op.alter_column("games", "rawg_id", new_column_name="igdb_id")
    op.alter_column("games", "rawg_rating", new_column_name="igdb_rating")
    op.drop_constraint("uq_games_rawg_id", "games", type_="unique")
    op.create_unique_constraint(op.f("uq_games_igdb_id"), "games", ["igdb_id"])


def downgrade() -> None:
    conn = op.get_bind()
    count = conn.execute(sa.text("SELECT COUNT(*) FROM games")).scalar()
    if count and count > 0:
        raise RuntimeError(
            "Cannot migrate games table with existing rows; reset the DB or delete games, because ids come from a different source."
        )

    op.drop_constraint("uq_games_igdb_id", "games", type_="unique")
    op.alter_column("games", "igdb_id", new_column_name="rawg_id")
    op.alter_column("games", "igdb_rating", new_column_name="rawg_rating")
    op.create_unique_constraint(op.f("uq_games_rawg_id"), "games", ["rawg_id"])
