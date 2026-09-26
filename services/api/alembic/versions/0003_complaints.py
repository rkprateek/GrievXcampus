"""Create complaints and complaint images for Week 4."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0003_complaints"
down_revision: str | Sequence[str] | None = "0002_auth_rbac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "complaints",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="submitted",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_complaints_student_id", "complaints", ["student_id"], unique=False)
    op.create_index("ix_complaints_status", "complaints", ["status"], unique=False)

    op.create_table(
        "complaint_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index("ix_complaint_images_complaint_id", "complaint_images", ["complaint_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_complaint_images_complaint_id", table_name="complaint_images")
    op.drop_table("complaint_images")
    op.drop_index("ix_complaints_status", table_name="complaints")
    op.drop_index("ix_complaints_student_id", table_name="complaints")
    op.drop_table("complaints")
