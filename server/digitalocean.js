// server/digitalocean.js — DigitalOcean DNS API integration for App Factory
// Handles automatic CNAME record creation for {slug}.dante.id → cname.vercel-dns.com

const DO_API = "https://api.digitalocean.com/v2";
const DOMAIN = "dante.id";
const CNAME_TARGET = "cname.vercel-dns.com."; // trailing dot required by DO DNS

/**
 * Creates a CNAME DNS record on DigitalOcean:
 *   {slug}.dante.id → cname.vercel-dns.com
 *
 * @param {object} opts
 * @param {string} opts.slug - App slug (e.g. "personal-crm-a7f3")
 * @param {string} opts.doToken - DigitalOcean API token
 * @returns {Promise<void>}
 */
export async function createDnsRecord({ slug, doToken }) {
  if (!doToken) throw new Error("DO_TOKEN not configured");

  const resp = await fetch(`${DO_API}/domains/${DOMAIN}/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${doToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "CNAME",
      name: slug,
      data: CNAME_TARGET,
      ttl: 300,
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    // 422 typically means the record already exists — treat as success
    if (resp.status === 422) {
      const msg = (data.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("conflict")) {
        console.log(`[DO DNS] CNAME record for ${slug}.${DOMAIN} already exists — skipping`);
        return;
      }
    }
    throw new Error(
      `DigitalOcean DNS API error (${resp.status}): ${data.message || JSON.stringify(data)}`
    );
  }

  console.log(`[DO DNS] Created CNAME: ${slug}.${DOMAIN} → ${CNAME_TARGET} (id=${data.domain_record?.id})`);
}
