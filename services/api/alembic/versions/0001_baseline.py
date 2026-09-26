"""Week 2 database baseline.

No domain tables are introduced yet. Domain models are added in their
corresponding roadmap weeks so the weekly scope remains controlled.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0001_baseline"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
