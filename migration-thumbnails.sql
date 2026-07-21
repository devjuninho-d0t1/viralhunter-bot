-- Vitrine 9:16 — colunas de thumbnail nos links
alter table links add column if not exists thumbnail_url text;
alter table links add column if not exists thumbnail_status text default 'pending';
-- 'pending' = ainda não resolvido | 'ok' = capa hospedada | 'failed' = sem capa
