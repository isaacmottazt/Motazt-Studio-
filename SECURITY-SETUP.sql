-- Motazt Studio — endurecimento do Supabase
-- Revise os nomes dos papéis e execute no SQL Editor do projeto Supabase.
-- Este arquivo NÃO deve ser executado automaticamente sem validar o schema.

-- 1) RLS nas tabelas privadas.
alter table if exists public.galerias enable row level security;
alter table if exists public.fotos enable row level security;

-- 2) Remova políticas amplas existentes antes de recriar as mínimas.
-- Ajuste os nomes caso suas políticas tenham nomenclatura diferente.
drop policy if exists "Allow public read" on public.galerias;
drop policy if exists "Allow public read" on public.fotos;
drop policy if exists "allow anon all" on public.galerias;
drop policy if exists "allow anon all" on public.fotos;

-- 3) Usuários não autenticados podem apenas validar um álbum ativo e não expirado.
-- A aplicação já solicita somente colunas públicas; dados sensíveis, como telefone,
-- devem ser removidos de uma view/RPC pública se estiverem presentes na tabela base.
create policy "public_read_active_galerias"
on public.galerias
for select
to anon, authenticated
using (
  status = 'ativa'
  and (data_expiracao is null or data_expiracao > now())
);

create policy "public_read_active_fotos"
on public.fotos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.galerias g
    where g.id = fotos.galeria_id
      and g.status = 'ativa'
      and (g.data_expiracao is null or g.data_expiracao > now())
  )
);

-- 4) Operações administrativas somente para usuários autenticados com role admin.
-- Configure app_metadata.role = 'admin' nos usuários administradores.
create policy "admin_manage_galerias"
on public.galerias
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_manage_fotos"
on public.fotos
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 5) Torne o bucket de originais privado.
update storage.buckets
set public = false
where id = 'fotos';

-- 6) Nenhum anônimo pode listar, enviar, alterar ou apagar objetos.
-- O acesso de leitura deve ser feito por URL assinada após validação do álbum.
drop policy if exists "Public read fotos" on storage.objects;
drop policy if exists "Public upload fotos" on storage.objects;
drop policy if exists "Public delete fotos" on storage.objects;

create policy "admin_read_fotos_storage"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fotos'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "admin_write_fotos_storage"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "admin_update_fotos_storage"
on storage.objects
for update
to authenticated
using (bucket_id = 'fotos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check (bucket_id = 'fotos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_delete_fotos_storage"
on storage.objects
for delete
to authenticated
using (bucket_id = 'fotos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- IMPORTANTE: ao tornar o bucket privado, substitua getPublicUrl() no frontend
-- por createSignedUrl() e armazene o path do objeto, não uma URL pública.
