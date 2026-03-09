/**
 * CostsTab — shows per-phase token usage and cost from task.metadata.costs
 */

/* ── Helpers ──────────────────────────────────────────────── */

function formatTokens(n) {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n) {
  if (n == null) return '—';
  return `$${n.toFixed(2)}`;
}

function formatDurationMs(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function costColor(cost) {
  if (cost == null || cost < 0.10) return '#386A20';  // green
  if (cost < 0.50) return '#E8A317';                  // yellow
  return '#BA1A1A';                                    // red
}

function phaseName(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Component ────────────────────────────────────────────── */

export default function CostsTab({ metadata }) {
  const costs = metadata?.costs;
  if (!costs || typeof costs !== 'object') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--md-outline, #79747E)', fontSize: 13, fontStyle: 'italic' }}>
        No cost data yet
      </div>
    );
  }

  const phases = typeof costs === 'object' && !Array.isArray(costs) ? costs : {};
  const totalCost = metadata.totalCost ?? Object.values(phases).reduce((s, p) => s + (p?.cost || 0), 0);
  const totalTokens = metadata.totalTokens ?? Object.values(phases).reduce((s, p) => s + (p?.totalTokens || 0), 0);
  const totalDurationMs = Object.values(phases).reduce((s, p) => s + (p?.durationMs || 0), 0);

  const phaseEntries = Object.entries(phases);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        padding: '14px 16px', borderRadius: 10,
        background: 'var(--md-surface-container-low, #F7F2FA)',
        border: '1px solid var(--md-surface-variant, #E7E0EC)',
      }}>
        <SummaryChip label="Total Cost" value={formatCost(totalCost)} color={costColor(totalCost)} />
        <SummaryChip label="Total Tokens" value={formatTokens(totalTokens)} color="var(--md-on-surface, #1C1B1F)" />
        <SummaryChip label="Total Time" value={formatDurationMs(totalDurationMs)} color="var(--md-on-surface-variant, #49454F)" />
      </div>

      {/* Phase breakdown */}
      {phaseEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--md-outline, #79747E)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Phase Breakdown</div>

          {phaseEntries.map(([key, phase]) => (
            <PhaseRow key={key} name={phaseName(key)} phase={phase || {}} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function SummaryChip({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--md-outline, #79747E)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function PhaseRow({ name, phase }) {
  const color = costColor(phase.cost);

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10,
      background: 'var(--md-surface-container-low, #F7F2FA)',
      border: '1px solid var(--md-surface-variant, #E7E0EC)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Phase name + cost badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface, #1C1B1F)' }}>{name}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color,
          padding: '2px 8px', borderRadius: 100,
          background: `${color}14`,
        }}>
          {formatCost(phase.cost ?? 0)}
        </span>
      </div>

      {/* Details as bullet list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--md-on-surface-variant, #49454F)' }}>
        {phase.model && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--md-outline, #79747E)' }}>•</span>
            <span>Model: <strong>{phase.model}</strong></span>
          </div>
        )}
        {(phase.inputTokens != null || phase.outputTokens != null) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--md-outline, #79747E)' }}>•</span>
            <span>Tokens: {formatTokens(phase.inputTokens)} in → {formatTokens(phase.outputTokens)} out</span>
          </div>
        )}
        {phase.durationMs != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--md-outline, #79747E)' }}>•</span>
            <span>Duration: {formatDurationMs(phase.durationMs)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
