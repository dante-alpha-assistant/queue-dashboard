import { Router } from "express";
import supabase from "../supabase.js";

export const router = Router();

const ROTATION_RUNBOOK_TEMPLATE = `Token Rotation Runbook v5 (Mar 14 2026)
Stakater Reloader is now installed — rotations are fully gitops-native.

NEW_ANTHROPIC_TOKEN: {NEW_TOKEN}

Prerequisites:
- SSH access to 167.235.61.168
- KUBECONFIG=/etc/rancher/k3s/k3s.yaml
- Gitops repo: /tmp/dante-gitops

Step 1 — Pull gitops + fetch cert:
  cd /tmp && (git clone https://x-access-token:$GH_TOKEN@github.com/dante-alpha-assistant/dante-gitops.git || (cd /tmp/dante-gitops && git pull))
  kubeseal --controller-name=sealed-secrets --controller-namespace=kube-system --fetch-cert > /tmp/ss-cert.pem

Step 2 — Pre-rotation check (STOP if any key is EMPTY):
  for SECRET in neo-env neo-worker-env ifra-worker-env; do
    echo "--- $SECRET ---"
    kubectl get secret $SECRET -n agents -o json | python3 -c "
  import sys,json,base64
  d=json.load(sys.stdin)
  for k,v in sorted(d['data'].items()):
    val=base64.b64decode(v).decode()
    print(f'{k}: {chr(34)}OK{chr(34)} if val.strip() else {chr(34)}EMPTY!{chr(34)}')"
  done

Step 3 — Seal new token into all 3 secrets:
  Key counts:
  - neo-env: ANTHROPIC_API_KEY, DISCORD_BOT_TOKEN, GH_TOKEN, OPENAI_API_KEY, OPENCLAW_GATEWAY_TOKEN, OPENROUTER_API_KEY, SUPABASE_SERVICE_ROLE_KEY
  - neo-worker-env: ANTHROPIC_API_KEY, GH_TOKEN, OPENAI_API_KEY, OPENCLAW_GATEWAY_TOKEN, OPENROUTER_API_KEY
  - ifra-worker-env: ANTHROPIC_API_KEY, GH_TOKEN, OPENCLAW_GATEWAY_TOKEN, OPENROUTER_API_KEY, SUPABASE_MGMT_TOKEN, SUPABASE_SERVICE_ROLE_KEY

  For each secret, run:
    kubectl create secret generic <SECRET_NAME> -n agents --dry-run=client -o json \\
      --from-literal=ANTHROPIC_API_KEY="{NEW_TOKEN}" \\
      --from-literal=<OTHER_KEY>=$(kubectl get secret <SECRET_NAME> -n agents -o jsonpath='{.data.<OTHER_KEY>}' | base64 -d) \\
      ... \\
    | kubeseal --cert /tmp/ss-cert.pem --controller-name=sealed-secrets --controller-namespace=kube-system --format yaml \\
    > /tmp/dante-gitops/agents/<agent>/sealed-secret.yaml

Step 4 — Commit + push:
  cd /tmp/dante-gitops
  git add agents/neo/sealed-secret.yaml agents/neo-worker/sealed-secret.yaml agents/ifra-worker/sealed-secret.yaml
  git commit -m "chore: token rotation — new Anthropic OAuth token"
  git push

Step 5 — Verify (~2 min after push):
  kubectl get pods -n agents -l "app in (neo,neo-worker,ifra-worker)" --no-headers
  for AGENT in neo neo-worker ifra-worker; do
    POD=$(kubectl get pods -n agents -l app=$AGENT --field-selector=status.phase=Running -o name | tail -1)
    echo -n "$AGENT: "
    kubectl exec -n agents $POD -- node -e "const d=JSON.parse(require('fs').readFileSync('/root/.openclaw/agents/main/agent/auth-profiles.json')); const p=d.profiles['anthropic:default']||d['anthropic:default']||{}; console.log('type='+(p.type||'?'),'prefix='+(p.access||p.key||'').slice(0,30))"
  done

Auth-profiles format: sk-ant-oat01-* → { type: 'oauth', provider: 'anthropic', access: token }

Critical Rules:
- NEVER hardcode token values in deployment env
- ALWAYS run Step 2 (pre-rotation check) — empty keys get sealed as empty
- ALWAYS verify DISCORD_BOT_TOKEN survives in neo-env
- ALWAYS overwrite agents/<name>/sealed-secret.yaml — never create custom-named files
`;

// All agents that have ANTHROPIC_API_KEY in their sealed secrets
const ANTHROPIC_AGENTS = [
  "neo", "neo-worker", "ifra-worker", "neo-chat-worker",
  "research-worker", "setup-agent"
];

// POST /api/settings/rotate-claude-token
router.post("/rotate-claude-token", async (req, res) => {
  try {
    // Auth required
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { token } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Missing token" });
    }

    const trimmed = token.trim();
    if (!trimmed.startsWith("sk-ant-")) {
      return res.status(400).json({ error: "Invalid token — must start with sk-ant-" });
    }

    // Task description: runbook instructions WITHOUT the raw token
    // The raw token is passed securely via metadata (not visible in task list)
    const description = `## Claude OAuth Token Rotation

**Target agents:** ${ANTHROPIC_AGENTS.join(", ")}

### Instructions for setup-agent:
1. Clone gitops repo: \`dante-alpha-assistant/dante-gitops\`
2. Fetch kubeseal cert: \`kubeseal --controller-name=sealed-secrets --controller-namespace=kube-system --fetch-cert > /tmp/ss-cert.pem\`
3. For EACH agent in the target list:
   a. Get current secret: \`kubectl get secret <agent>-env -n agents -o json\`
   b. Replace ANTHROPIC_API_KEY with the new token from metadata.token
   c. Re-seal ALL keys (not just the changed one): \`kubectl create secret generic <agent>-env ... | kubeseal ...\`
   d. Write to \`agents/<agent>/sealed-secret.yaml\` in the gitops repo
4. Git commit + push all changed sealed-secret.yaml files
5. Verify ArgoCD syncs and pods restart (Stakater Reloader handles this)
6. Verify auth-profiles.json on at least 2 agents shows the new token prefix

### Critical Rules:
- NEVER hardcode token values in deployment env vars
- Pre-rotation check: verify no keys are EMPTY before sealing
- ALWAYS preserve DISCORD_BOT_TOKEN in neo-env
- Overwrite \`agents/<name>/sealed-secret.yaml\` — never create custom-named files
- The raw token is in \`metadata.token\` — DO NOT log it or put it in the result field`;

    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({
        title: "Claude OAuth Token Rotation",
        type: "setup",
        status: "assigned",
        assigned_agent: "setup-agent",
        dispatched_by: req.user.email || "dashboard",
        created_by: req.user.id,
        priority: "urgent",
        description,
        metadata: {
          token: trimmed,
          target_agents: ANTHROPIC_AGENTS,
          secret_key: "ANTHROPIC_API_KEY",
          gitops_repo: "dante-alpha-assistant/dante-gitops",
          action: "rotate-anthropic-token",
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("[settings] Failed to create rotation task:", error.message);
      return res.status(500).json({ error: "Failed to create task: " + error.message });
    }

    console.log(`[settings] Token rotation task created: ${data.id} → setup-agent`);
    res.json({
      taskId: data.id,
      message: `Token rotation task dispatched to setup-agent for ${ANTHROPIC_AGENTS.length} agents`,
      targetAgents: ANTHROPIC_AGENTS,
    });
  } catch (e) {
    console.error("[settings] rotate-claude-token error:", e.message);
    res.status(500).json({ error: e.message });
  }
});
