# Supabase Sound Space

This is a beginner-friendly music player app built with Next.js, Tailwind CSS, and Supabase.

It lets you:
- upload local audio files
- store the files in a Supabase Storage bucket
- save song metadata in a Supabase table
- refresh the page without losing the music library

## Important setup steps

1. Create a Supabase project on the free tier.
2. Create a storage bucket called `music`.
3. Make the bucket public so the player can stream audio.
4. Create a table named `tracks` with this structure:

```sql
create table public.tracks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  artist text not null default 'Unknown artist',
  file_path text not null,
  file_size bigint not null default 0,
  mime_type text not null default 'audio/mpeg',
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

create policy "Anyone can read tracks"
on public.tracks
for select
using (true);

create policy "Anyone can insert tracks"
on public.tracks
for insert
with check (true);
```

5. Copy `.env.local.example` to `.env.local` and fill in your real Supabase URL and anon key.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Beginner explanations

### Next.js
Next.js is a framework for building web apps with React. It handles routing, pages, and server-side rendering in a simple structure.

### Tailwind CSS
Tailwind is a CSS tool that gives you ready-made utility classes like `bg-slate-900`, `text-white`, `rounded-2xl`, and `p-4` so you can style without writing lots of custom CSS.

### Supabase
Supabase is a backend service. It gives you a database, file storage, and authentication. For this project, the useful parts are:
- Storage: keeps uploaded MP3 files
- Database: keeps song metadata
- Public access: lets the browser play the files without losing them on refresh

### Key terms
- Storage bucket: a folder for uploaded files
- Table: a database collection of rows and columns
- Row: one record, like one song
- Column: a field, like title, artist, or file_path
- Public URL: a web address that can be used by the browser to fetch a file
- Anon key: a public key used by front-end apps to access Supabase features
- Refresh: when the browser reloads the page

## Free tier note

This app is designed to work on Supabase's free plan. The app is simple and beginner-friendly. For a real production app, you would usually add stricter rules and auth.
