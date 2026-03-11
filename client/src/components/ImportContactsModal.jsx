import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, FileSpreadsheet, X, AlertTriangle, CheckCircle2, ChevronDown, History, ArrowLeft, Users, Merge, SkipForward } from "lucide-react";

const TABS = [
  { key: "csv", label: "CSV", icon: FileSpreadsheet },
  { key: "vcard", label: "vCard", icon: FileText },
  { key: "history", label: "History", icon: History },
];

const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "role", label: "Role/Title" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "source", label: "Source" },
];

export default function ImportContactsModal({ onClose, onImported }) {
  const [tab, setTab] = useState("csv");
  const [step, setStep] = useState("upload"); // upload | preview | result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // CSV state
  const [csvData, setCsvData] = useState(null); // raw text
  const [csvFilename, setCsvFilename] = useState("");
  const [csvPreview, setCsvPreview] = useState(null); // from server
  const [mapping, setMapping] = useState({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // vCard state
  const [vcfData, setVcfData] = useState(null);
  const [vcfFilename, setVcfFilename] = useState("");

  // Result state
  const [result, setResult] = useState(null);

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef(null);

  // ── File reading ─────────────────────────────────────────────────────

  const handleFile = useCallback((file) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (tab === "csv") {
        setCsvData(text);
        setCsvFilename(file.name);
        // Auto-parse
        parseCSVPreview(text, file.name);
      } else {
        setVcfData(text);
        setVcfFilename(file.name);
        setStep("preview");
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }, [tab]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── CSV Parse ─────────────────────────────────────────────────────────

  const parseCSVPreview = async (data, filename) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, filename }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to parse CSV");
      setCsvPreview(json);
      setMapping(json.mapping || {});
      setStep("preview");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── CSV Confirm ───────────────────────────────────────────────────────

  const confirmCSVImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import/csv/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: csvData,
          mapping,
          filename: csvFilename,
          skipDuplicates,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult(json);
      setStep("result");
      if (json.imported > 0) onImported?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── vCard Import ──────────────────────────────────────────────────────

  const importVCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: vcfData, filename: vcfFilename }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult(json);
      setStep("result");
      if (json.imported > 0) onImported?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── History ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (tab === "history") {
      setHistoryLoading(true);
      fetch("/api/import/history?limit=20")
        .then(r => r.json())
        .then(json => setHistory(json.data || []))
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [tab]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const reset = () => {
    setStep("upload");
    setCsvData(null);
    setCsvFilename("");
    setCsvPreview(null);
    setVcfData(null);
    setVcfFilename("");
    setMapping({});
    setResult(null);
    setError(null);
  };

  // ── Styles ────────────────────────────────────────────────────────────

  const overlayStyle = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };

  const modalStyle = {
    background: "var(--md-surface)", borderRadius: 20, width: "100%", maxWidth: 720,
    maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
    border: "1px solid var(--md-surface-variant)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };

  const headerStyle = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px 0", gap: 12,
  };

  const bodyStyle = {
    flex: 1, overflow: "auto", padding: "16px 20px 20px",
  };

  const btnPrimary = {
    padding: "10px 24px", borderRadius: 20, border: "none",
    background: "var(--md-primary)", color: "var(--md-on-primary)",
    fontWeight: 600, fontSize: 13, cursor: "pointer",
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex", alignItems: "center", gap: 6,
  };

  const btnSecondary = {
    ...btnPrimary,
    background: "var(--md-surface-container, var(--md-surface-variant))",
    color: "var(--md-on-surface)",
    border: "1px solid var(--md-surface-variant)",
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step !== "upload" && tab !== "history" && (
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", display: "flex", padding: 4 }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <Upload size={20} style={{ color: "var(--md-primary)" }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>Import Contacts</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--md-on-surface-variant)", display: "flex", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "12px 20px 0", borderBottom: "1px solid var(--md-surface-variant)" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== tab) reset(); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "var(--md-primary)" : "var(--md-on-surface-variant)",
                borderBottom: tab === t.key ? "2px solid var(--md-primary)" : "2px solid transparent",
                marginBottom: -1, fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              background: "rgba(186,26,26,0.1)", borderRadius: 10, marginBottom: 12,
              color: "#ef4444", fontSize: 13,
            }}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* ── CSV Tab ── */}
          {tab === "csv" && step === "upload" && (
            <DropZone
              accept=".csv,.tsv,.txt"
              hint="Drop a CSV file here, or click to browse"
              subHint="Supports .csv, .tsv, .txt — Max 10,000 rows"
              icon={<FileSpreadsheet size={40} style={{ color: "var(--md-primary)", opacity: 0.6 }} />}
              onFile={handleFile}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              fileInputRef={fileInputRef}
              loading={loading}
            />
          )}

          {tab === "csv" && step === "preview" && csvPreview && (
            <CSVPreview
              preview={csvPreview}
              mapping={mapping}
              onMappingChange={setMapping}
              skipDuplicates={skipDuplicates}
              onSkipDuplicatesChange={setSkipDuplicates}
              onConfirm={confirmCSVImport}
              loading={loading}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
            />
          )}

          {/* ── vCard Tab ── */}
          {tab === "vcard" && step === "upload" && (
            <DropZone
              accept=".vcf,.vcard"
              hint="Drop a vCard file here, or click to browse"
              subHint="Supports .vcf — Handles vCard 2.1, 3.0, 4.0"
              icon={<FileText size={40} style={{ color: "var(--md-primary)", opacity: 0.6 }} />}
              onFile={handleFile}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              fileInputRef={fileInputRef}
              loading={loading}
            />
          )}

          {tab === "vcard" && step === "preview" && (
            <div>
              <div style={{
                padding: "14px 16px", borderRadius: 12, background: "var(--md-surface-container, var(--md-surface-variant))",
                marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
              }}>
                <FileText size={18} style={{ color: "var(--md-primary)" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--md-on-surface)" }}>{vcfFilename}</div>
                  <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>vCard file ready for import</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={reset} style={btnSecondary} disabled={loading}>Cancel</button>
                <button onClick={importVCard} style={btnPrimary} disabled={loading}>
                  {loading ? "Importing..." : "Import Contacts"}
                </button>
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {step === "result" && result && (
            <ImportResult result={result} onDone={onClose} btnPrimary={btnPrimary} />
          )}

          {/* ── History Tab ── */}
          {tab === "history" && (
            <ImportHistory history={history} loading={historyLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function DropZone({ accept, hint, subHint, icon, onFile, onDrop, onDragOver, fileInputRef, loading }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDrop={(e) => { setDragOver(false); onDrop(e); }}
      onDragOver={(e) => { setDragOver(true); onDragOver(e); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? "var(--md-primary)" : "var(--md-surface-variant)"}`,
        borderRadius: 16, padding: "48px 24px", textAlign: "center", cursor: "pointer",
        background: dragOver ? "rgba(99,102,241,0.05)" : "transparent",
        transition: "all 0.2s",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={e => onFile(e.target.files?.[0])}
      />
      <div style={{ marginBottom: 12 }}>{icon}</div>
      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)" }}>
        {loading ? "Parsing file..." : hint}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--md-on-surface-variant)" }}>{subHint}</p>
    </div>
  );
}

function CSVPreview({ preview, mapping, onMappingChange, skipDuplicates, onSkipDuplicatesChange, onConfirm, loading, btnPrimary, btnSecondary }) {
  const { headers, totalRows, preview: rows, duplicates, availableFields } = preview;

  const updateMapping = (field, colIdx) => {
    const newMapping = { ...mapping };
    if (colIdx === "" || colIdx === undefined) {
      delete newMapping[field];
    } else {
      newMapping[field] = parseInt(colIdx);
    }
    onMappingChange(newMapping);
  };

  const mappedCount = rows.filter(r => r.name || mapping.name !== undefined).length;

  return (
    <div>
      {/* Summary */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap",
      }}>
        <Stat label="Total Rows" value={totalRows} color="var(--md-on-surface)" />
        <Stat label="Valid" value={mappedCount} color="#22c55e" />
        <Stat label="Duplicates" value={duplicates} color="#f97316" />
      </div>

      {/* Column Mapping */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)" }}>Column Mapping</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--md-on-surface-variant)" }}>
          Map your CSV columns to contact fields. Auto-detected mappings are pre-filled.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {CONTACT_FIELDS.map(f => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--md-on-surface-variant)",
                width: 70, flexShrink: 0,
              }}>
                {f.label}{f.required ? " *" : ""}
              </label>
              <div style={{ position: "relative", flex: 1 }}>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={e => updateMapping(f.key, e.target.value)}
                  style={{
                    width: "100%", padding: "6px 28px 6px 10px", borderRadius: 8,
                    border: `1px solid ${mapping[f.key] !== undefined ? "var(--md-primary)" : "var(--md-surface-variant)"}`,
                    background: "var(--md-surface)", color: "var(--md-on-surface)",
                    fontSize: 12, fontFamily: "'Inter', system-ui, sans-serif",
                    outline: "none", cursor: "pointer", appearance: "none",
                  }}
                >
                  <option value="">— skip —</option>
                  {headers.map((h, idx) => (
                    <option key={idx} value={idx}>{h}</option>
                  ))}
                </select>
                <ChevronDown size={12} style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  pointerEvents: "none", color: "var(--md-on-surface-variant)",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Duplicate handling */}
      {duplicates > 0 && (
        <div style={{
          padding: "10px 14px", borderRadius: 10, marginBottom: 16,
          background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AlertTriangle size={16} style={{ color: "#f97316", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#f97316" }}>
              {duplicates} duplicate{duplicates !== 1 ? "s" : ""} found
            </span>
            <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginLeft: 8 }}>
              (matched by email)
            </span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "var(--md-on-surface)" }}>
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={e => onSkipDuplicatesChange(e.target.checked)}
              style={{ accentColor: "var(--md-primary)" }}
            />
            Skip duplicates
          </label>
        </div>
      )}

      {/* Preview table */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)" }}>
          Preview ({Math.min(rows.length, 10)} of {totalRows} rows)
        </h3>
        <div style={{ overflow: "auto", borderRadius: 10, border: "1px solid var(--md-surface-variant)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--md-surface-container, var(--md-surface-variant))" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--md-surface-variant)" }}>
                  <td style={tdStyle}>{r.name || <span style={{ color: "var(--md-on-surface-variant)", fontStyle: "italic" }}>—</span>}</td>
                  <td style={tdStyle}>{r.email || "—"}</td>
                  <td style={tdStyle}>{r.company || "—"}</td>
                  <td style={tdStyle}>
                    {r.duplicate ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#f97316", fontWeight: 600 }}>
                        <Merge size={12} /> Duplicate
                      </span>
                    ) : r.name ? (
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>New</span>
                    ) : (
                      <span style={{ color: "var(--md-on-surface-variant)" }}>Skip (no name)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onConfirm} style={btnPrimary} disabled={loading || !mapping.name}>
          {loading ? "Importing..." : `Import ${totalRows - (skipDuplicates ? duplicates : 0)} Contact${totalRows - (skipDuplicates ? duplicates : 0) !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

function ImportResult({ result, onDone, btnPrimary }) {
  const { imported, skipped, duplicates, errors, total } = result;
  const success = errors === 0;

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ marginBottom: 16 }}>
        {success ? (
          <CheckCircle2 size={48} style={{ color: "#22c55e" }} />
        ) : (
          <AlertTriangle size={48} style={{ color: "#f97316" }} />
        )}
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>
        {success ? "Import Complete!" : "Import Completed with Errors"}
      </h3>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <Stat label="Total" value={total} color="var(--md-on-surface)" />
        <Stat label="Imported" value={imported} color="#22c55e" />
        {duplicates > 0 && <Stat label="Duplicates" value={duplicates} color="#f97316" />}
        {skipped > 0 && <Stat label="Skipped" value={skipped} color="var(--md-on-surface-variant)" />}
        {errors > 0 && <Stat label="Errors" value={errors} color="#ef4444" />}
      </div>
      <button onClick={onDone} style={btnPrimary}>
        Done
      </button>
    </div>
  );
}

function ImportHistory({ history, loading }) {
  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)", fontSize: 13 }}>Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)",
        background: "var(--md-surface-container, var(--md-surface-variant))",
        borderRadius: 12,
      }}>
        <History size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: 13 }}>No imports yet</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {history.map(h => (
        <div key={h.id} style={{
          padding: "12px 16px", borderRadius: 10,
          background: "var(--md-surface-container, var(--md-surface-variant))",
          border: "1px solid var(--md-surface-variant)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {h.type === "csv" ? <FileSpreadsheet size={14} style={{ color: "#22c55e" }} /> : <FileText size={14} style={{ color: "#6366f1" }} />}
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--md-on-surface)" }}>{h.filename || "Unknown"}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                background: h.type === "csv" ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)",
                color: h.type === "csv" ? "#22c55e" : "#6366f1",
                textTransform: "uppercase",
              }}>{h.type}</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
              {new Date(h.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            <span>{h.total_rows} total</span>
            <span style={{ color: "#22c55e" }}>{h.imported} imported</span>
            {h.duplicates > 0 && <span style={{ color: "#f97316" }}>{h.duplicates} dupes</span>}
            {h.skipped > 0 && <span>{h.skipped} skipped</span>}
            {h.errors > 0 && <span style={{ color: "#ef4444" }}>{h.errors} errors</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

const thStyle = {
  padding: "8px 12px", textAlign: "left", fontWeight: 600,
  color: "var(--md-on-surface-variant)", fontSize: 11,
  textTransform: "uppercase", letterSpacing: "0.4px",
};

const tdStyle = {
  padding: "8px 12px", color: "var(--md-on-surface)",
};
