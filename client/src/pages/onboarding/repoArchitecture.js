/**
 * Compute the proposed repository architecture based on app name and description.
 * Returns an array of repo objects: { name, role }
 */
export function computeProposedArchitecture(name, description) {
  const slug = (name || "my-app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-app";

  const desc = (description || "").toLowerCase();

  // Complex / distributed architecture
  if (/microservice|microservices|distributed|multiple services/.test(desc)) {
    return [
      { name: `${slug}-frontend`, role: "Frontend" },
      { name: `${slug}-api`, role: "Backend API" },
      { name: `${slug}-worker`, role: "Background Worker" },
    ];
  }

  // Full-stack app
  if (/frontend|backend|api|rest api|server|client.?side|web app|full.?stack/.test(desc)) {
    return [
      { name: `${slug}-frontend`, role: "Frontend" },
      { name: `${slug}-api`, role: "Backend API" },
    ];
  }

  // Simple / monorepo
  return [{ name: slug, role: "Monorepo" }];
}
