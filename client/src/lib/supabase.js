import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lessxkxujvcmublgwdaa.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlc3N4a3h1anZjbXVibGd3ZGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjE0NjUsImV4cCI6MjA4NjkzNzQ2NX0.QUPJCOPGkMoTwBWDJHR1HElv5rSJgQxqBPQ0p_r4EXI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
