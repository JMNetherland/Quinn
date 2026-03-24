-- Quinn — Session 16
-- Adds inactive flag to study_materials for Pause/Resume controls.
-- inactive = false (default) → active, included in Quinn's context
-- inactive = true            → paused, excluded from context but kept in dashboard
-- archived_at IS NOT NULL    → permanently deleted (existing soft-delete pattern)

alter table study_materials add column if not exists inactive boolean not null default false;
