import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client configured with a user's JWT token.
 * This client will respect Row Level Security policies.
 * @param {string} userToken - The user's JWT token from Authorization header
 * @returns {Object} Supabase client configured for the user
 */
export function createUserSupabaseClient(userToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
    }
  );
}

/**
 * Express middleware that creates a user-scoped Supabase client and attaches it to req.supabase
 */
export function attachUserSupabase(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Extract the user token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const userToken = authHeader.slice(7);
  req.supabase = createUserSupabaseClient(userToken);
  next();
}