-- Apelidos de minerador (rodar no SQL editor do Supabase)
--
-- O mesmo humano chega com nomes diferentes dependendo do canal: senderName
-- do WhatsApp ("Rodrigo Ribeiro"), username do Telegram ("Rodrigo"), literal
-- "painel" quando o link é colado na plataforma. Esta tabela mapeia cada
-- nome cru (normalizado em minúsculas) para um nome único de exibição.
--
-- Os links NÃO são reescritos: added_by continua guardando o que o canal
-- mandou, e a resolução acontece na leitura — então o histórico inteiro se
-- corrige sozinho e dá pra desfazer um apelido a qualquer momento.
create table if not exists miner_aliases (
  alias text primary key,
  display_name text not null,
  updated_at timestamptz default now()
);
