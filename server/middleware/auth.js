import { createClient } from "@supabase/supabase-js";

// Use service role key to verify JWTs server-side
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Express middleware that verifies a Supabase JWT from the Authorization header.
 * Returns 401 if the token is missing or invalid.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Missing or invalid Authorization header");
    return res.status(401).json({ error: "Unauthorized - Missing token" });
  }

  const token = authHeader.slice(7);
  console.log("Validating token:", token.substring(0, 20) + "...");
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error) {
    console.log("Token validation error:", error.message);
    return res.status(401).json({ error: `Token validation failed: ${error.message}` });
  }

  if (!user) {
    console.log("Token valid but no user found");
    return res.status(401).json({ error: "No user found for token" });
  }

  console.log("Token validation successful for user:", user.id);
  req.user = user;
  next();
}
