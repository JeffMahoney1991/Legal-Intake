import { useState, useEffect, useCallback } from "react";
import { load, save } from "./storage";

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—";

const LEGAL_AREAS = ["Traffic Ticket","Criminal","Family","Employment","Landlord/Tenant","Small Claims","Personal Injury","Regulatory/Licensing","Debt/Collections","Human Rights","Immigration","Real Estate","Wills/Estates","Corporate/Commercial","Other"];
const PROVINCES = ["Nova Scotia","Ontario","British Columbia","Alberta","Quebec","Manitoba","Saskatchewan","New Brunswick","Newfoundland","PEI","Yukon","NWT","Nunavut"];

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 3px; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade { animation: fadeIn 0.2s ease; }
`;

const K = {
  bg: "#0c0e14", bgCard: "#12151e", bgInput: "#0a0c12", bgHover: "#181c28",
  border: "#1e2230", borderLight: "#252a38",
  text: "#c8cdd8", textBright: "#e8ecf2", textDim: "#5a6274", textFaint: "#3a4050",
  accent: "#4fd1a5", accentDim: "#2a7a5a", accentGlow: "#4fd1a520",
  warn: "#f0b45a", warnDim: "#f0b45a20",
  red: "#ef6b6b", redDim: "#ef6b6b20",
  blue: "#5b8af0", blueDim: "#5b8af020",
  purple: "#a07cf0", purpleDim: "#a07cf020",
};

const S = {
  app: { fontFamily: "'Outfit', sans-serif", background: K.bg, color: K.text, height: "100vh", display: "flex" },
  nav: { width: 220, background: K.bgCard, borderRight: `1px solid ${K.border}`, display: "flex", flexDirection: "column", flexShrink: 0 },
  navHead: { padding: "20px 18px", borderBottom: `1px solid ${K.border}` },
  navTitle: { fontSize: 16, fontWeight: 700, color: K.accent, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 },
  navSub: { fontSize: 10, color: K.textDim, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: 1.5 },
  navItem: (a) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", cursor: "pointer",
    background: a ? K.accentGlow : "transparent", color: a ? K.accent : K.textDim,
    borderLeft: a ? `2px solid ${K.accent}` : "2px solid transparent",
    fontSize: 13, fontWeight: a ? 600 : 400, transition: "all 0.1s",
  }),
  navIcon: { fontSize: 15, width: 20, textAlign: "center" },
  main: { flex: 1, overflow: "auto", padding: 0 },
  page: { padding: "28px 32px", maxWidth: 1200, boxSizing: "border-box" },
  h1: { fontSize: 22, fontWeight: 700, color: K.textBright, marginBottom: 20, letterSpacing: -0.5 },
  h2: { fontSize: 16, fontWeight: 600, color: K.textBright, marginBottom: 14, letterSpacing: -0.3 },
  h3: { fontSize: 14, fontWeight: 600, color: K.accent, marginBottom: 10 },
  card: { background: K.bgCard, border: `1px solid ${K.border}`, borderRadius: 10, padding: 20, marginBottom: 16 },
  cardFlat: { background: K.bgCard, border: `1px solid ${K.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 20 },
  stat: { background: K.bgCard, border: `1px solid ${K.border}`, borderRadius: 10, padding: "16px 18px" },
  statVal: { fontSize: 28, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: -1 },
  statLabel: { fontSize: 11, color: K.textDim, marginTop: 2, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'IBM Plex Mono', monospace" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  label: { display: "block", fontSize: 11, fontWeight: 500, color: K.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'IBM Plex Mono', monospace" },
  input: { width: "100%", padding: "9px 12px", background: K.bgInput, border: `1px solid ${K.border}`, borderRadius: 6, color: K.text, fontSize: 13, fontFamily: "'Outfit', sans-serif", outline: "none" },
  select: { width: "100%", padding: "9px 12px", background: K.bgInput, border: `1px solid ${K.border}`, borderRadius: 6, color: K.text, fontSize: 13, fontFamily: "'Outfit', sans-serif" },
  textarea: { width: "100%", padding: "9px 12px", background: K.bgInput, border: `1px solid ${K.border}`, borderRadius: 6, color: K.text, fontSize: 13, fontFamily: "'Outfit', sans-serif", minHeight: 70, resize: "vertical", outline: "none" },
  btnP: { padding: "9px 18px", background: K.accent, color: K.bg, border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" },
  btnS: { padding: "8px 14px", background: "transparent", color: K.accent, border: `1px solid ${K.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif" },
  btnD: { padding: "8px 14px", background: K.redDim, color: K.red, border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${K.border}`, color: K.textDim, fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "'IBM Plex Mono', monospace" },
  td: { padding: "11px 14px", borderBottom: `1px solid ${K.border}08` },
  tr: { transition: "background 0.1s", cursor: "pointer" },
  badge: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: c + "18", color: c, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 0.3 }),
  pill: (on) => ({ padding: "5px 12px", borderRadius: 4, border: `1px solid ${on ? K.accent : K.border}`, background: on ? K.accentGlow : "transparent", color: on ? K.accent : K.textDim, fontSize: 11, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: on ? 600 : 400 }),
  empty: { textAlign: "center", padding: "50px 20px", color: K.textDim },
  field: { marginBottom: 14 },
  barTrack: { height: 6, background: K.border, borderRadius: 3, overflow: "hidden" },
  barFill: (pct, color) => ({ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }),
};

const BC = { Critical: K.red, High: K.warn, Medium: K.blue, Low: K.textDim, Strong: K.accent, Moderate: K.warn, Weak: K.red, Unclear: K.purple, Active: K.accent, Inactive: K.red, Paused: K.warn, Pending: K.warn, Referred: K.blue, Accepted: K.accent, Converted: K.accent, Declined: K.red, Yes: K.accent, No: K.textDim, "Limited-Scope": K.blue, Premium: K.accent, Good: K.blue, Contingency: K.warn, "Legal Aid": K.purple, "Self-Help": K.textDim };
function Badge({ children }) { return <span style={S.badge(BC[children] || K.textDim)}>{children}</span>; }
function Field({ label, children }) { return <div style={S.field}><label style={S.label}>{label}</label>{children}</div>; }

// ─── LAWYERS PAGE ────────────────────────────────────────────────────
function LawyersPage({ lawyers, setLawyers }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const blank = () => ({ id: uid(), name: "", firm: "", email: "", phone: "", city: "", province: "Nova Scotia", areas: [], languages: ["English"], maxCases: 10, status: "Active", rating: 5, notes: "", created: now() });

  const startNew = () => { setForm(blank()); setEditing("new"); };
  const startEdit = (l) => { setForm({ ...l }); setEditing(l.id); };
  const cancel = () => { setForm(null); setEditing(null); };

  const saveForm = async () => {
    if (!form.name || !form.email) return;
    const u = editing === "new" ? [...lawyers, form] : lawyers.map(l => l.id === editing ? form : l);
    setLawyers(u); await save("lawyers", u); cancel();
  };
  const remove = async (id) => { const u = lawyers.filter(l => l.id !== id); setLawyers(u); await save("lawyers", u); };
  const toggleArea = (a) => setForm(f => ({ ...f, areas: f.areas.includes(a) ? f.areas.filter(x => x !== a) : [...f.areas, a] }));

  if (form) return (
    <div className="fade" style={S.page}>
      <div style={S.h1}>{editing === "new" ? "Add Lawyer" : "Edit Lawyer"}</div>
      <div style={S.card}>
        <div style={S.grid2}>
          <Field label="Full Name *"><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Firm"><input style={S.input} value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} /></Field>
          <Field label="Email *"><input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Phone"><input style={S.input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="City"><input style={S.input} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></Field>
          <Field label="Province"><select style={S.select} value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}>{PROVINCES.map(p => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Max Cases / Month"><input style={S.input} type="number" value={form.maxCases} onChange={e => setForm(f => ({ ...f, maxCases: parseInt(e.target.value) || 0 }))} /></Field>
          <Field label="Rating (1–10)"><input style={S.input} type="number" min={1} max={10} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) || 5 }))} /></Field>
          <Field label="Status">
            <select style={S.select} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option>Active</option><option>Inactive</option><option>Paused</option>
            </select>
          </Field>
          <Field label="Languages"><input style={S.input} value={form.languages.join(", ")} onChange={e => setForm(f => ({ ...f, languages: e.target.value.split(",").map(s => s.trim()) }))} placeholder="English, French" /></Field>
        </div>
        <Field label="Practice Areas">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {LEGAL_AREAS.map(a => <button key={a} style={S.pill(form.areas.includes(a))} onClick={() => toggleArea(a)}>{a}</button>)}
          </div>
        </Field>
        <Field label="Notes"><textarea style={S.textarea} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={S.btnP} onClick={saveForm}>Save</button>
          <button style={S.btnS} onClick={cancel}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade" style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={S.h1}>Referral Network</div>
        <button style={S.btnP} onClick={startNew}>+ Add Lawyer</button>
      </div>
      {lawyers.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>⚖</div>
          <div>No lawyers added yet. Build your referral network.</div>
          <button style={{ ...S.btnP, marginTop: 16 }} onClick={startNew}>Add First Lawyer</button>
        </div>
      ) : (
        <div style={S.cardFlat}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Lawyer</th><th style={S.th}>Areas</th><th style={S.th}>Province</th>
              <th style={S.th}>Status</th><th style={S.th}>Rating</th><th style={S.th}></th>
            </tr></thead>
            <tbody>{lawyers.map(l => (
              <tr key={l.id} style={S.tr} onClick={() => startEdit(l)} onMouseOver={e => e.currentTarget.style.background = K.bgHover} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                <td style={S.td}><div style={{ fontWeight: 600, color: K.textBright }}>{l.name}</div>{l.firm && <div style={{ fontSize: 11, color: K.textDim }}>{l.firm}</div>}</td>
                <td style={S.td}><div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{l.areas.slice(0, 3).map((a, i) => <span key={i} style={S.badge(K.blue)}>{a}</span>)}{l.areas.length > 3 && <span style={{ fontSize: 10, color: K.textDim }}>+{l.areas.length - 3}</span>}</div></td>
                <td style={S.td}>{l.province}</td>
                <td style={S.td}><Badge>{l.status}</Badge></td>
                <td style={{ ...S.td, fontFamily: "'IBM Plex Mono', monospace" }}>{l.rating}/10</td>
                <td style={S.td}><button style={S.btnD} onClick={e => { e.stopPropagation(); remove(l.id); }}>×</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── CASES PAGE ──────────────────────────────────────────────────────
function CasesPage({ cases, lawyers, setCases }) {
  const [selected, setSelected] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [filter, setFilter] = useState("All");

  const assignLawyer = async (caseId, lawyerId) => {
    const lawyer = lawyers.find(l => l.id === lawyerId);
    const u = cases.map(c => c.id === caseId ? { ...c, referredLawyer: { id: lawyer.id, name: lawyer.name, firm: lawyer.firm }, status: "Referred", referredDate: now() } : c);
    setCases(u); await save("cases", u); setAssigning(false);
  };
  const updateStatus = async (caseId, status) => {
    const u = cases.map(c => c.id === caseId ? { ...c, status, converted: status === "Accepted" } : c);
    setCases(u); await save("cases", u);
  };

  const filtered = filter === "All" ? cases : cases.filter(c => c.status === filter);
  const statusCounts = { All: cases.length, Pending: 0, Referred: 0, Accepted: 0, Declined: 0, Active: 0 };
  cases.forEach(c => { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });

  if (selected) {
    const c = cases.find(x => x.id === selected);
    if (!c) { setSelected(null); return null; }
    return (
      <div className="fade" style={S.page}>
        <button style={{ ...S.btnS, marginBottom: 16 }} onClick={() => setSelected(null)}>← Back</button>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
          <div style={S.h1}>Case #{c.id.slice(0, 6)}</div>
          <Badge>{c.status}</Badge>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <div>
            {c.assessment && (
              <div style={S.card}>
                <div style={S.h2}>Assessment</div>
                <div style={S.grid2}>
                  <div><div style={S.label}>Legal Area</div><div style={{ color: K.textBright }}>{c.assessment.legalArea}</div></div>
                  <div><div style={S.label}>Province</div><div style={{ color: K.textBright }}>{c.assessment.province}</div></div>
                  <div><div style={S.label}>Urgency</div><Badge>{c.assessment.urgency}</Badge></div>
                  <div><div style={S.label}>Strength</div><Badge>{c.assessment.caseStrength}</Badge></div>
                  <div><div style={S.label}>Financial Stakes</div><div style={{ color: K.textBright }}>{c.assessment.stakesFinancial}</div></div>
                  <div><div style={S.label}>Lawyer Rec.</div><Badge>{c.assessment.lawyerRecommended}</Badge></div>
                </div>
                {c.assessment.stakesFlags?.length > 0 && c.assessment.stakesFlags[0] !== "none" && (
                  <div style={{ marginTop: 12 }}><div style={S.label}>Stakes Flags</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>{c.assessment.stakesFlags.map((f, i) => <span key={i} style={S.badge(K.red)}>{f}</span>)}</div></div>
                )}
                <div style={{ marginTop: 12 }}><div style={S.label}>Summary</div><div style={{ fontSize: 13, color: K.textBright, lineHeight: 1.5, marginTop: 4 }}>{c.assessment.summary}</div></div>
                {c.assessment.keyIssues?.length > 0 && (
                  <div style={{ marginTop: 12 }}><div style={S.label}>Key Issues</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>{c.assessment.keyIssues.map((k, i) => <span key={i} style={S.badge(K.blue)}>{k}</span>)}</div></div>
                )}
                {c.assessment.nextSteps?.length > 0 && (
                  <div style={{ marginTop: 12 }}><div style={S.label}>Next Steps</div>{c.assessment.nextSteps.map((s, i) => <div key={i} style={{ fontSize: 12, color: K.text, padding: "3px 0" }}>→ {s}</div>)}</div>
                )}
                {c.assessment.leadType && <div style={{ marginTop: 12 }}><div style={S.label}>Lead Type</div><Badge>{c.assessment.leadType}</Badge></div>}
              </div>
            )}
            {c.messages?.length > 0 && (
              <div style={S.card}>
                <div style={S.h2}>Conversation ({c.messages.length} messages)</div>
                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  {c.messages.map((m, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < c.messages.length - 1 ? `1px solid ${K.border}` : "none" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: m.role === "user" ? K.blue : K.accent, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>{m.role === "user" ? "Client" : "AI Assistant"}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            {c.contact && (
              <div style={S.card}>
                <div style={S.h3}>Contact</div>
                <div style={{ fontSize: 13, lineHeight: 2 }}>
                  <div><span style={{ ...S.label, display: "inline" }}>Name: </span><span style={{ color: K.textBright }}>{c.contact.name}</span></div>
                  <div><span style={{ ...S.label, display: "inline" }}>Email: </span><span style={{ color: K.textBright }}>{c.contact.email}</span></div>
                  <div><span style={{ ...S.label, display: "inline" }}>Phone: </span><span style={{ color: K.textBright }}>{c.contact.phone || "—"}</span></div>
                  <div><span style={{ ...S.label, display: "inline" }}>City: </span><span style={{ color: K.textBright }}>{c.contact.city || "—"}, {c.contact.province}</span></div>
                  {c.contact.bestTime && <div><span style={{ ...S.label, display: "inline" }}>Best Time: </span><span style={{ color: K.textBright }}>{c.contact.bestTime}</span></div>}
                </div>
              </div>
            )}
            {c.documents?.length > 0 && (
              <div style={S.card}>
                <div style={S.h3}>Documents ({c.documents.length})</div>
                {c.documents.map(d => (
                  <div key={d.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${K.border}`, color: K.text }}>
                    📎 {d.name} <span style={{ color: K.textDim }}>({(d.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ))}
              </div>
            )}
            <div style={S.card}>
              <div style={S.h3}>Referral</div>
              {c.referredLawyer ? (
                <div>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: K.textDim }}>Assigned to: </span>
                    <span style={{ color: K.accent, fontWeight: 600 }}>{c.referredLawyer.name}</span>
                  </div>
                  {c.referredLawyer.firm && <div style={{ fontSize: 12, color: K.textDim }}>{c.referredLawyer.firm}</div>}
                  <div style={{ fontSize: 11, color: K.textDim, marginTop: 4 }}>Referred {fmt(c.referredDate)}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                    <button style={S.btnP} onClick={() => updateStatus(c.id, "Accepted")}>✓ Accepted</button>
                    <button style={S.btnD} onClick={() => updateStatus(c.id, "Declined")}>✕ Declined</button>
                    <button style={S.btnS} onClick={() => updateStatus(c.id, "Pending")}>⏳ Pending</button>
                  </div>
                </div>
              ) : (
                <div>
                  {assigning ? (
                    <div>
                      {lawyers.filter(l => l.status === "Active").length === 0 ? (
                        <div style={{ fontSize: 12, color: K.textDim }}>No active lawyers. Add one first.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {lawyers.filter(l => l.status === "Active").map(l => {
                            const areaMatch = c.assessment && l.areas.includes(c.assessment.legalArea);
                            const provMatch = c.assessment && l.province === c.assessment.province;
                            return (
                              <button key={l.id} style={{ ...S.btnS, textAlign: "left", padding: "8px 10px", border: `1px solid ${areaMatch && provMatch ? K.accent : K.border}`, background: areaMatch && provMatch ? K.accentGlow : "transparent" }}
                                onClick={() => assignLawyer(c.id, l.id)}>
                                <div style={{ fontWeight: 600, color: K.textBright, fontSize: 12 }}>{l.name}</div>
                                <div style={{ fontSize: 10, color: K.textDim }}>{l.areas.slice(0, 2).join(", ")}{areaMatch ? " ✓area" : ""}{provMatch ? " ✓prov" : ""}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button style={{ ...S.btnS, marginTop: 8, width: "100%" }} onClick={() => setAssigning(false)}>Cancel</button>
                    </div>
                  ) : (
                    <button style={{ ...S.btnP, width: "100%" }} onClick={() => setAssigning(true)}>Assign Lawyer</button>
                  )}
                </div>
              )}
            </div>
            <div style={S.card}>
              <div style={S.h3}>Case Status</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Pending", "Accepted", "Declined"].map(s => (
                  <button key={s} style={c.status === s ? S.btnP : S.btnS} onClick={() => updateStatus(c.id, s)}>
                    {s === "Accepted" ? "✓ " : s === "Declined" ? "✕ " : "⏳ "}{s}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: K.textDim, marginTop: 8 }}>Current: <Badge>{c.status}</Badge></div>
            </div>
            <div style={S.card}>
              <div style={S.h3}>Metadata</div>
              <div style={{ fontSize: 12, lineHeight: 2, color: K.textDim }}>
                <div>Created: {fmt(c.created)}</div>
                <div>Updated: {fmt(c.updated)}</div>
                <div>Messages: {c.messages?.length || 0}</div>
                <div>Documents: {c.documents?.length || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade" style={S.page}>
      <div style={S.h1}>Cases</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button key={status} style={S.pill(filter === status)} onClick={() => setFilter(status)}>
            {status} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={S.empty}>No {filter === "All" ? "" : filter.toLowerCase() + " "}cases found.</div>
      ) : (
        <div style={S.cardFlat}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Case</th><th style={S.th}>Area</th><th style={S.th}>Urgency</th>
              <th style={S.th}>Strength</th><th style={S.th}>Lead</th><th style={S.th}>Status</th>
              <th style={S.th}>Lawyer</th><th style={S.th}>Date</th>
            </tr></thead>
            <tbody>{[...filtered].reverse().map(c => (
              <tr key={c.id} style={S.tr} onClick={() => setSelected(c.id)} onMouseOver={e => e.currentTarget.style.background = K.bgHover} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                <td style={S.td}><div style={{ fontWeight: 600, color: K.textBright, fontSize: 12 }}>#{c.id.slice(0, 6)}</div><div style={{ fontSize: 10, color: K.textDim }}>{c.contact?.name || c.label || "—"}</div></td>
                <td style={S.td}><Badge>{c.assessment?.legalArea || "—"}</Badge></td>
                <td style={S.td}><Badge>{c.assessment?.urgency || "—"}</Badge></td>
                <td style={S.td}><Badge>{c.assessment?.caseStrength || "—"}</Badge></td>
                <td style={S.td}><Badge>{c.assessment?.leadType || "—"}</Badge></td>
                <td style={S.td}><Badge>{c.status}</Badge></td>
                <td style={S.td}>{c.referredLawyer?.name || <span style={{ color: K.textFaint }}>—</span>}</td>
                <td style={{ ...S.td, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: K.textDim }}>{fmt(c.created)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────
function DashboardPage({ cases, lawyers }) {
  const total = cases.length;
  const pending = cases.filter(c => c.status === "Pending").length;
  const referred = cases.filter(c => c.referredLawyer).length;
  const converted = cases.filter(c => c.converted).length;
  const declined = cases.filter(c => c.status === "Declined").length;
  const accepted = cases.filter(c => c.status === "Accepted").length;
  const convRate = referred > 0 ? ((accepted / referred) * 100).toFixed(0) : 0;

  const byArea = {};
  cases.forEach(c => { const a = c.assessment?.legalArea || "Unknown"; byArea[a] = (byArea[a] || 0) + 1; });
  const sortedAreas = Object.entries(byArea).sort((a, b) => b[1] - a[1]);
  const maxArea = sortedAreas.length > 0 ? sortedAreas[0][1] : 1;

  const byLawyer = {};
  cases.filter(c => c.referredLawyer).forEach(c => {
    const n = c.referredLawyer.name;
    if (!byLawyer[n]) byLawyer[n] = { referred: 0, accepted: 0 };
    byLawyer[n].referred++;
    if (c.status === "Accepted") byLawyer[n].accepted++;
  });

  const urgentPending = cases.filter(c => c.status === "Pending" && (c.assessment?.urgency === "Critical" || c.assessment?.urgency === "High"));

  return (
    <div className="fade" style={S.page}>
      <div style={S.h1}>Dashboard</div>
      <div style={S.statsRow}>
        <div style={S.stat}><div style={{ ...S.statVal, color: K.textBright }}>{total}</div><div style={S.statLabel}>Total Cases</div></div>
        <div style={S.stat}><div style={{ ...S.statVal, color: K.warn }}>{pending}</div><div style={S.statLabel}>Pending</div></div>
        <div style={S.stat}><div style={{ ...S.statVal, color: K.blue }}>{referred}</div><div style={S.statLabel}>Referred</div></div>
        <div style={S.stat}><div style={{ ...S.statVal, color: K.accent }}>{accepted}</div><div style={S.statLabel}>Accepted</div></div>
        <div style={S.stat}><div style={{ ...S.statVal, color: K.red }}>{declined}</div><div style={S.statLabel}>Declined</div></div>
        <div style={S.stat}><div style={{ ...S.statVal, color: K.accent }}>{convRate}%</div><div style={S.statLabel}>Accept Rate</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={S.card}>
          <div style={S.h2}>Volume by Area</div>
          {sortedAreas.length === 0 ? <div style={{ color: K.textDim, fontSize: 13 }}>No data</div> :
            sortedAreas.map(([area, count]) => (
              <div key={area} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: K.text }}>{area}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: K.accent }}>{count}</span>
                </div>
                <div style={S.barTrack}><div style={S.barFill((count / maxArea) * 100, K.accent)} /></div>
              </div>
            ))
          }
        </div>
        <div style={S.card}>
          <div style={S.h2}>Lawyer Performance</div>
          {Object.keys(byLawyer).length === 0 ? <div style={{ color: K.textDim, fontSize: 13 }}>No referrals yet</div> :
            Object.entries(byLawyer).map(([name, d]) => (
              <div key={name} style={{ padding: "10px 0", borderBottom: `1px solid ${K.border}` }}>
                <div style={{ fontWeight: 600, color: K.textBright, fontSize: 13 }}>{name}</div>
                <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                  <span style={{ color: K.blue }}>REF {d.referred}</span>
                  <span style={{ color: K.accent }}>ACC {d.accepted}</span>
                  <span style={{ color: d.referred > 0 ? K.textBright : K.textDim }}>{d.referred > 0 ? ((d.accepted / d.referred) * 100).toFixed(0) : 0}%</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {urgentPending.length > 0 && (
        <div style={{ ...S.card, border: `1px solid ${K.red}33` }}>
          <div style={{ ...S.h2, color: K.red }}>⚠ Urgent Unassigned ({urgentPending.length})</div>
          {urgentPending.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${K.border}` }}>
              <div>
                <span style={{ fontWeight: 600, color: K.textBright, fontSize: 12 }}>#{c.id.slice(0, 6)}</span>
                <span style={{ marginLeft: 8, fontSize: 12 }}>{c.contact?.name || c.label}</span>
                <span style={{ marginLeft: 8 }}><Badge>{c.assessment?.legalArea}</Badge></span>
              </div>
              <Badge>{c.assessment?.urgency}</Badge>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <div style={S.h2}>Network Health</div>
        <div style={S.grid3}>
          <div><div style={S.label}>Active Lawyers</div><div style={{ ...S.statVal, fontSize: 20, color: K.accent }}>{lawyers.filter(l => l.status === "Active").length}</div></div>
          <div><div style={S.label}>Inactive / Paused</div><div style={{ ...S.statVal, fontSize: 20, color: K.red }}>{lawyers.filter(l => l.status !== "Active").length}</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────
function SettingsPage({ cases, lawyers, setCases, setLawyers }) {
  const exportData = () => {
    const d = JSON.stringify({ lawyers, cases, exported: now() }, null, 2);
    const b = new Blob([d], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
    a.download = `legaltriage-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const clearCases = async () => { if (confirm("Delete all cases?")) { setCases([]); await save("cases", []); } };
  const clearLawyers = async () => { if (confirm("Delete all lawyers?")) { setLawyers([]); await save("lawyers", []); } };
  const clearAll = async () => { if (confirm("Delete ALL data?")) { setCases([]); setLawyers([]); await save("cases", []); await save("lawyers", []); } };

  return (
    <div className="fade" style={S.page}>
      <div style={S.h1}>Settings</div>
      <div style={S.card}>
        <div style={S.h2}>Export</div>
        <button style={S.btnP} onClick={exportData}>Export All Data (JSON)</button>
        <div style={{ marginTop: 8, fontSize: 12, color: K.textDim }}>Downloads lawyers + cases as JSON backup.</div>
      </div>
      <div style={S.card}>
        <div style={S.h2}>Danger Zone</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btnD} onClick={clearCases}>Delete All Cases</button>
          <button style={S.btnD} onClick={clearLawyers}>Delete All Lawyers</button>
          <button style={{ ...S.btnD, background: K.red + "33" }} onClick={clearAll}>Delete Everything</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.h2}>System</div>
        <div style={{ fontSize: 12, color: K.textDim, lineHeight: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
          <div>Lawyers: {lawyers.length} ({lawyers.filter(l => l.status === "Active").length} active)</div>
          <div>Cases: {cases.length} ({cases.filter(c => c.status === "Pending").length} pending)</div>
          <div>Storage: Browser persistent storage</div>
          <div>AI: Claude Sonnet 4 via Anthropic API</div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", icon: "◧", label: "Dashboard" },
  { id: "cases", icon: "☰", label: "Cases" },
  { id: "lawyers", icon: "⚖", label: "Lawyers" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [lawyers, setLawyers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { (async () => { setLawyers(await load("lawyers", [])); setCases(await load("cases", [])); setLoaded(true); })(); }, []);

  // Poll for case updates from client app
  useEffect(() => {
    if (!loaded) return;
    const iv = setInterval(async () => { const c = await load("cases", []); if (JSON.stringify(c) !== JSON.stringify(cases)) setCases(c); }, 5000);
    return () => clearInterval(iv);
  }, [loaded, cases]);

  if (!loaded) return <div style={{ ...S.app, justifyContent: "center", alignItems: "center" }}><span style={{ color: K.textDim }}>Loading…</span></div>;

  const pendingCount = cases.filter(c => c.status === "Pending").length;

  if (isMobile) {
    return (
      <div style={{ ...S.app, flexDirection: "column" }}>
        <style>{css}</style>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${K.border}`, background: K.bgCard, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={S.navTitle}><span>⚖</span> LegalTriage</div>
            <div style={{ fontSize: 9, color: K.textDim, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>Admin</div>
          </div>
          <div style={{ fontSize: 10, color: K.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>
            {cases.length} cases
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ padding: "16px 14px", maxWidth: "100%" }}>
            {tab === "dashboard" && <DashboardPage cases={cases} lawyers={lawyers} />}
            {tab === "cases" && <CasesPage cases={cases} lawyers={lawyers} setCases={setCases} />}
            {tab === "lawyers" && <LawyersPage lawyers={lawyers} setLawyers={setLawyers} />}
            {tab === "settings" && <SettingsPage cases={cases} lawyers={lawyers} setCases={setCases} setLawyers={setLawyers} />}
          </div>
        </div>
        <div style={{
          display: "flex", borderTop: `1px solid ${K.border}`, background: K.bgCard, flexShrink: 0,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {TABS.map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "10px 4px", cursor: "pointer",
              color: tab === t.id ? K.accent : K.textDim,
              background: tab === t.id ? K.accentGlow : "transparent",
              position: "relative",
            }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
              {t.id === "cases" && pendingCount > 0 && (
                <span style={{
                  position: "absolute", top: 6, right: "calc(50% - 18px)",
                  width: 16, height: 16, borderRadius: 8, background: K.warn,
                  color: K.bg, fontSize: 9, fontWeight: 700, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>{pendingCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{css}</style>
      <nav style={S.nav}>
        <div style={S.navHead}>
          <div style={S.navTitle}><span>⚖</span> LegalTriage</div>
          <div style={S.navSub}>Admin Panel</div>
        </div>
        <div style={{ flex: 1, paddingTop: 8 }}>
          {TABS.map(t => (
            <div key={t.id} style={S.navItem(tab === t.id)} onClick={() => setTab(t.id)}>
              <span style={S.navIcon}>{t.icon}</span>
              <span>{t.label}</span>
              {t.id === "cases" && pendingCount > 0 && <span style={{ ...S.badge(K.warn), marginLeft: "auto", fontSize: 10 }}>{pendingCount}</span>}
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 18px", borderTop: `1px solid ${K.border}`, fontSize: 10, color: K.textFaint, fontFamily: "'IBM Plex Mono', monospace" }}>
          {lawyers.filter(l => l.status === "Active").length} active lawyers · {cases.length} cases
        </div>
      </nav>
      <div style={S.main}>
        {tab === "dashboard" && <DashboardPage cases={cases} lawyers={lawyers} />}
        {tab === "cases" && <CasesPage cases={cases} lawyers={lawyers} setCases={setCases} />}
        {tab === "lawyers" && <LawyersPage lawyers={lawyers} setLawyers={setLawyers} />}
        {tab === "settings" && <SettingsPage cases={cases} lawyers={lawyers} setCases={setCases} setLawyers={setLawyers} />}
      </div>
    </div>
  );
}
