"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Track = {
  id: string;
  title: string;
  user_id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type AuthMode = "signin" | "signup";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** index;
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("Loading your music library...");

  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setInitializing(false);
      return;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (initializing) return;
    fetchTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initializing]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setAuthStatus(null);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          setAuthStatus("Account created and you are signed in!");
        } else {
          setAuthStatus("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthStatus("Signed in successfully.");
      }
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setAuthStatus(`Error: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthStatus(`Sign out failed: ${error.message}`);
    } else {
      setTracks([]);
      setSelectedTrack(null);
      setAuthStatus(null);
    }
  };

  const fetchTracks = async () => {
    if (!supabase) {
      setStatus("Add your Supabase project URL and anon key to .env.local to load tracks.");
      setLoading(false);
      return;
    }

    if (!user) {
      setTracks([]);
      setSelectedTrack(null);
      setStatus("Sign in to see your private library.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("Could not load tracks. Make sure your tracks table has a user_id column and correct RLS policies.");
      setLoading(false);
      return;
    }

    setTracks(data ?? []);
    setSelectedTrack((current) => {
      if (current && (data ?? []).some((t) => t.id === current.id)) return current;
      return data?.[0] ?? null;
    });
    setStatus(data && data.length > 0 ? "Your music is ready to play." : "No tracks yet. Upload your first song.");
    setLoading(false);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      const safeTitle = selected.name.replace(/\.[^/.]+$/, "");
      setTitle((current) => current || safeTitle);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!supabase || !file) {
      setStatus("Choose an audio file before uploading.");
      return;
    }

    if (!user) {
      setStatus("You must be signed in to upload.");
      return;
    }

    setUploading(true);
    setStatus("Uploading to Supabase storage...");

    const safeName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const folder = user.id;
    const path = `${folder}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("music").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      setStatus(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("tracks").insert([
      {
        title: title || file.name.replace(/\.[^/.]+$/, ""),
        user_id: user.id,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || "audio/mpeg",
      },
    ]);

    if (insertError) {
      setStatus(`Database insert failed: ${insertError.message}`);
      setUploading(false);
      return;
    }

    setTitle("");
    setFile(null);
    setStatus("Uploaded successfully. Your song is saved in Supabase.");
    setUploading(false);
    await fetchTracks();
  };

  const getTrackUrl = (track: Track) => {
    if (!supabase) return "";
    return supabase.storage.from("music").getPublicUrl(track.file_path).data.publicUrl;
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#272b5c,_#0b1122_55%)] px-4 py-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Free-tier music app</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white">Supabase Sound Space</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                Upload local MP3s, keep them in Supabase, and play them back in a simple Spotify-inspired player.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  user
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                }`}
              >
                {supabase
                  ? user
                    ? `Signed in as ${user.email ?? user.id.slice(0, 8)}`
                    : "Not signed in"
                  : "Waiting for Supabase keys"}
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {!user && !initializing ? (
          <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20">
            <div className="mb-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setAuthStatus(null);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  authMode === "signin"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setAuthStatus(null);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  authMode === "signup"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuth} className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-white outline-none transition focus:border-cyan-400"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-white outline-none transition focus:border-cyan-400"
                  placeholder="At least 6 characters"
                />
              </label>
              <div className="md:col-span-2 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={authLoading || !supabase}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {authLoading
                    ? "Please wait..."
                    : authMode === "signup"
                    ? "Create account"
                    : "Sign in"}
                </button>
                {authStatus ? (
                  <p
                    className={`text-sm ${
                      authStatus.startsWith("Error")
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {authStatus}
                  </p>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        {user ? (
          <>
            <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20">
                <h2 className="text-xl font-semibold text-white">Upload a song</h2>
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div className="grid gap-4">
                    <label className="block text-sm text-slate-300">
                      Song title
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-white outline-none transition focus:border-cyan-400"
                        placeholder="Midnight drive"
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-slate-300">
                    Audio file
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={onFileChange}
                      className="mt-2 block w-full cursor-pointer rounded-2xl border border-dashed border-slate-700 bg-slate-900/80 px-3 py-4 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-medium file:text-slate-950"
                    />
                  </label>

                  {file ? (
                    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                      Selected: {file.name} · {formatBytes(file.size)}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!file || uploading || !supabase || !user}
                    className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {uploading ? "Uploading..." : "Upload to Supabase"}
                  </button>
                </form>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20">
                <h2 className="text-xl font-semibold text-white">Player</h2>
                {selectedTrack ? (
                  <div className="mt-5 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-purple-200">Now playing</p>
                    <h3 className="mt-3 text-2xl font-bold text-white">{selectedTrack.title}</h3>
                    <audio controls src={getTrackUrl(selectedTrack)} className="mt-5 w-full" />
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-300">
                    Upload a song to start listening.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white">Your library</h2>
                <button
                  type="button"
                  onClick={() => fetchTracks()}
                  className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                >
                  Refresh
                </button>
              </div>

              <p className="mt-3 text-sm text-slate-300">{status}</p>

              {loading ? (
                <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                  Loading library...
                </div>
              ) : (
                <div className="mt-6 grid gap-3">
                  {tracks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
                      No music in your private library yet.
                    </div>
                  ) : (
                    tracks.map((track) => {
                      const isSelected = selectedTrack?.id === track.id;
                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => setSelectedTrack(track)}
                          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-cyan-400 bg-cyan-500/10"
                              : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-white">{track.title}</p>
                          </div>
                          <span className="text-xs text-slate-400">{formatBytes(track.file_size)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
