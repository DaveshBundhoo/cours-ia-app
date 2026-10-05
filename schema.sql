-- À coller dans Supabase > SQL Editor > New query, puis "Run"

-- 1) Table des cours
create table if not exists public.cours (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  matiere     text not null,
  auteur      text not null,
  fichier     text not null,          -- chemin dans le bucket "cours"
  texte       text,                   -- texte transcrit par l'IA (rempli plus tard)
  statut      text not null default 'en attente',  -- en attente | en cours | transcrit | erreur
  created_at  timestamptz not null default now()
);

create index if not exists cours_matiere_idx on public.cours (matiere);

-- 2) Sécurité : seuls les élèves connectés peuvent lire et déposer
alter table public.cours enable row level security;

create policy "Lecture pour les connectés"
  on public.cours for select to authenticated using (true);

create policy "Dépôt par son propre compte"
  on public.cours for insert to authenticated with check (user_id = auth.uid());

create policy "Suppression de ses propres cours"
  on public.cours for delete to authenticated using (user_id = auth.uid());

-- 3) Bucket de stockage (privé) pour les photos / PDF
insert into storage.buckets (id, name, public)
values ('cours', 'cours', false)
on conflict (id) do nothing;

create policy "Lire les fichiers (connectés)"
  on storage.objects for select to authenticated
  using (bucket_id = 'cours');

create policy "Envoyer ses fichiers dans son dossier"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cours' and (storage.foldername(name))[1] = auth.uid()::text);
