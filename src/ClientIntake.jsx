import { useState, useEffect, useRef, useCallback } from "react";
import { load, save } from "./storage";

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const fmt = (iso) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

const INTAKE_SYSTEM = `You are an AI legal intake assistant. You help people understand their legal situation, collect relevant facts, and determine whether they need a lawyer.

IMPORTANT RULES:
- You are NOT a lawyer. Never give legal advice. Frame assessments as "Based on the information provided, this appears to be..."
- Be empathetic but efficient. Ask one question at a time or a small related group.
- Focus only on questions that affect the legal analysis. Never ask about irrelevant procedural details.
- Collect info across a few rounds of questions before assessing. Don't assess on the very first reply — get the province, the core facts, and what's at stake first.

DOCUMENT ANALYSIS:
When the user uploads documents (images, PDFs, text files), analyze them immediately and thoroughly:
- Extract every relevant fact: dates, times, amounts, names, locations, violation codes, deadlines, terms.
- Cross-reference documents against each other for contradictions or timing issues.
- State the key legal issue clearly.
- Follow-up questions should ONLY ask things that materially affect the legal outcome.

INFORMATION TO COLLECT:
1. What happened (the core facts)
2. Where — province/state (REQUIRED before assessment)
3. When — dates, deadlines, limitation periods
4. Who is involved and whether they have a lawyer
5. What the user wants and what they stand to lose
6. What stage the matter is at
7. What documents they have

After collecting enough information (typically 2-4 exchanges), provide your assessment conversationally, then append this EXACT block (the user won't see it — the system parses it):

===ASSESSMENT===
LEGAL_AREA: [Traffic Ticket, Criminal, Family, Employment, Landlord/Tenant, Small Claims, Personal Injury, Regulatory/Licensing, Debt/Collections, Human Rights, Immigration, Real Estate, Wills/Estates, Corporate/Commercial, or Other]
PROVINCE: [province/state]
URGENCY: [Critical, High, Medium, or Low]
CASE_STRENGTH: [Strong, Moderate, Weak, or Unclear]
STAKES_FINANCIAL: [dollar amount/range or "Non-financial"]
STAKES_FLAGS: [comma-separated: jail, criminal record, licence loss, deportation, custody loss, protection order, professional licence, regulatory penalty, bankruptcy, eviction, wage loss, reputational harm, limitation period, Charter issue — or "none"]
LAWYER_RECOMMENDED: [Yes, Limited-Scope, or No]
LEAD_TYPE: [Premium, Good, Limited-Scope, Contingency, Legal Aid, or Self-Help]
SUMMARY: [2-3 sentence case summary]
KEY_ISSUES: [comma-separated]
MISSING_INFO: [comma-separated or "none"]
NEXT_STEPS: [comma-separated]
===END===

IMPORTANT POST-ASSESSMENT FLOW — follow this order exactly:

1. FIRST, check the MISSING_INFO field you just generated. If it contains anything other than "none", ask the user about those items BEFORE recommending a lawyer. Say something like: "Before I connect you with a lawyer, a few more details would strengthen your case:" and ask about the missing items. Do NOT recommend a lawyer in this same response.

2. ONLY after the user has answered the missing info questions (or if MISSING_INFO was "none"), THEN recommend the lawyer. Say: "I'd recommend speaking with [Name] at [Firm] — they handle [area] cases in [province]. I'll pull up a connection form for you now." Do NOT ask "would you like me to connect you?" — just state the recommendation and tell them the form is appearing. The system will show it automatically.

3. If the user skips the missing info questions or says they don't know, that's fine — proceed to the lawyer recommendation anyway. Don't keep asking.

If they continue in self-help mode, help them: explain the process, draft documents, prepare hearing notes, create evidence lists, warn about deadlines.

Always end self-help guidance with: "I can help you prepare and understand your options, but I am not a lawyer and this is not a substitute for legal advice."`;

function parseAssessment(text) {
  const m = text.match(/===ASSESSMENT===([\s\S]*?)===END===/);
  if (!m) return null;
  const b = m[1];
  const g = (k) => { const x = b.match(new RegExp(`${k}:\\s*(.+)`)); return x ? x[1].trim() : ""; };
  return {
    legalArea: g("LEGAL_AREA"), province: g("PROVINCE"), urgency: g("URGENCY"),
    caseStrength: g("CASE_STRENGTH"), stakesFinancial: g("STAKES_FINANCIAL"),
    stakesFlags: g("STAKES_FLAGS").split(",").map(s => s.trim()).filter(Boolean),
    lawyerRecommended: g("LAWYER_RECOMMENDED"), leadType: g("LEAD_TYPE"),
    summary: g("SUMMARY"), keyIssues: g("KEY_ISSUES").split(",").map(s => s.trim()).filter(Boolean),
    missingInfo: g("MISSING_INFO").split(",").map(s => s.trim()).filter(Boolean),
    nextSteps: g("NEXT_STEPS").split(",").map(s => s.trim()).filter(Boolean),
  };
}
function stripAssessment(t) { return t.replace(/===ASSESSMENT===[\s\S]*?===END===/, "").trim(); }

// ─── Styles ──────────────────────────────────────────────────────────
const C = {
  bg: "#faf8f5", bgDeep: "#f0ece5", surface: "#ffffff", surfaceAlt: "#f7f5f0",
  border: "#e4ddd0", borderLight: "#ede8df",
  text: "#2c2418", textMuted: "#8a7e6e", textLight: "#b0a48f",
  accent: "#5b6e4e", accentLight: "#7a9168", accentPale: "#e8efe3",
  warm: "#c4935a", warmPale: "#fdf5ec",
  danger: "#a04040", dangerPale: "#fceaea",
  blue: "#4a6fa5", bluePale: "#eaf0f8",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.fade-up { animation: fadeUp 0.3s ease-out; }
.dot-pulse span { animation: pulse 1.2s ease-in-out infinite; }
.dot-pulse span:nth-child(2) { animation-delay: 0.15s; }
.dot-pulse span:nth-child(3) { animation-delay: 0.3s; }
`;

const S = {
  app: { fontFamily: "'DM Sans', sans-serif", background: C.bg, color: C.text, height: "100vh", display: "flex", overflow: "hidden" },
  sidebar: (open) => ({
    width: open ? 280 : 0, minWidth: open ? 280 : 0, background: C.surface, borderRight: `1px solid ${C.border}`,
    display: "flex", flexDirection: "column", transition: "all 0.25s ease", overflow: "hidden", flexShrink: 0,
  }),
  sideHead: { padding: "20px 18px 16px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" },
  sideTitle: { fontFamily: "'Crimson Pro', serif", fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: -0.3 },
  sideList: { flex: 1, overflow: "auto", padding: "8px 10px" },
  caseItem: (active) => ({
    padding: "12px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 4, transition: "all 0.15s",
    background: active ? C.accentPale : "transparent", border: `1px solid ${active ? C.accent + "33" : "transparent"}`,
  }),
  caseLabel: { fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  caseMeta: { fontSize: 11, color: C.textMuted },
  newBtn: {
    margin: "10px 12px 16px", padding: "10px 16px", background: C.accent, color: "#fff", border: "none",
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: {
    padding: "12px 20px", borderBottom: `1px solid ${C.borderLight}`, background: C.surface,
    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
  },
  toggleBtn: {
    width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer",
    color: C.textMuted, fontSize: 16,
  },
  tabs: { display: "flex", gap: 0, marginLeft: 16 },
  tab: (active) => ({
    padding: "6px 18px", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", border: "none",
    background: active ? C.accentPale : "transparent", color: active ? C.accent : C.textMuted,
    borderRadius: 6, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
  }),
  chatArea: { flex: 1, overflow: "auto", padding: "24px 20px 12px" },
  msgRow: (isUser) => ({ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }),
  bubble: (isUser) => ({
    maxWidth: "75%", padding: "12px 16px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    background: isUser ? C.accent : C.surface, color: isUser ? "#fff" : C.text,
    border: isUser ? "none" : `1px solid ${C.borderLight}`, fontSize: 14, lineHeight: 1.6,
    fontFamily: "'Crimson Pro', serif", fontWeight: 400, boxShadow: isUser ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
  }),
  sender: (isUser) => ({ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, color: isUser ? "rgba(255,255,255,0.6)" : C.textLight }),
  inputBar: { padding: "12px 20px 18px", borderTop: `1px solid ${C.borderLight}`, background: C.surface, display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 },
  input: {
    flex: 1, padding: "11px 14px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10,
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: C.text, resize: "none", minHeight: 42, maxHeight: 120,
    outline: "none", lineHeight: 1.4,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 10, background: C.accent, border: "none", color: "#fff",
    fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  assessCard: {
    background: C.warmPale, border: `1px solid ${C.warm}44`, borderRadius: 12, padding: 18, margin: "8px 0 16px",
  },
  assessTitle: { fontFamily: "'Crimson Pro', serif", fontSize: 17, fontWeight: 600, color: C.warm, marginBottom: 12 },
  assessGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  assessLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: C.textMuted, marginBottom: 2 },
  assessVal: { fontSize: 13, fontWeight: 500, color: C.text },
  badge: (color) => ({
    display: "inline-block", padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
    background: color + "18", color, border: `1px solid ${color}33`,
  }),
  referralCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, margin: "8px 0 16px" },
  field: { marginBottom: 12 },
  fieldLabel: { display: "block", fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 },
  fieldInput: {
    width: "100%", padding: "9px 12px", background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: C.text, outline: "none",
  },
  fieldSelect: {
    width: "100%", padding: "9px 12px", background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: C.text,
  },
  btnPrimary: {
    padding: "10px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  btnSecondary: {
    padding: "9px 16px", background: "transparent", color: C.accent, border: `1px solid ${C.accent}44`,
    borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  docList: { flex: 1, overflow: "auto", padding: "20px" },
  docItem: {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: C.surface,
    border: `1px solid ${C.borderLight}`, borderRadius: 10, marginBottom: 8, transition: "all 0.15s",
  },
  docIcon: { width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 },
  uploadZone: {
    border: `2px dashed ${C.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center",
    cursor: "pointer", transition: "all 0.2s", margin: "0 20px 16px",
  },
  empty: { textAlign: "center", padding: "60px 20px", color: C.textMuted },
};

const PROVINCES = ["Nova Scotia","Ontario","British Columbia","Alberta","Quebec","Manitoba","Saskatchewan","New Brunswick","Newfoundland","PEI","Yukon","NWT","Nunavut"];
const badgeColor = { Critical: C.danger, High: C.warm, Medium: C.blue, Low: C.textMuted, Strong: C.accent, Moderate: C.warm, Weak: C.danger, Unclear: "#8b5cf6", Yes: C.accent, No: C.textMuted, "Limited-Scope": C.blue };

function Badge({ children }) { return <span style={S.badge(badgeColor[children] || C.textMuted)}>{children}</span>; }

const DOC_COLORS = { pdf: "#e74c3c", doc: "#2980b9", docx: "#2980b9", jpg: "#8e44ad", jpeg: "#8e44ad", png: "#8e44ad", txt: "#7f8c8d", csv: "#27ae60", xls: "#27ae60", xlsx: "#27ae60", default: C.textMuted };
const DOC_ICONS = { pdf: "📄", doc: "📝", docx: "📝", jpg: "🖼", jpeg: "🖼", png: "🖼", txt: "📃", csv: "📊", xls: "📊", xlsx: "📊", default: "📎" };

function getExt(name) { const p = name.split("."); return p.length > 1 ? p.pop().toLowerCase() : "default"; }
function formatSize(bytes) { if (bytes < 1024) return bytes + " B"; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / 1048576).toFixed(1) + " MB"; }

// ─── Main App ────────────────────────────────────────────────────────
// Simple markdown renderer — handles bold, italic, bullet lists
function renderMarkdown(text) {
  if (!text || typeof text !== "string") return text;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Convert **bold** and *italic*
    const parts = [];
    let remaining = line;
    let key = 0;
    while (remaining) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch) {
        const idx = remaining.indexOf(boldMatch[0]);
        if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
        parts.push(<strong key={key++} style={{ fontWeight: 600 }}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(idx + boldMatch[0].length);
        continue;
      }
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    // Detect bullet lines
    const isBullet = /^[-•]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim());
    return (
      <div key={i} style={isBullet ? { paddingLeft: 12, textIndent: -8, marginTop: 2 } : i > 0 && line.trim() === "" ? { height: 8 } : undefined}>
        {parts}
      </div>
    );
  });
}

export default function App() {
  const [cases, setCases] = useState([]);
  const DEFAULT_LAWYER = {
    id: "default-jack", name: "Jack Smith", firm: "Jacks Law", email: "contact@jackslaw.com",
    phone: "", city: "", province: "", areas: [], languages: ["English", "French"],
    maxCases: 99, feePerLead: "0", feeStructure: "Per Lead", status: "Active", rating: 10, notes: "",
  };
  const [storedLawyers, setStoredLawyers] = useState([]);
  // Use stored lawyers if any exist, otherwise fall back to Jack Smith
  const lawyers = storedLawyers.length > 0 ? storedLawyers : [DEFAULT_LAWYER];
  const [activeId, setActiveId] = useState(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [docs, setDocs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [showReferral, setShowReferral] = useState(false);
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [referralForm, setReferralForm] = useState({ name: "", email: "", phone: "", city: "", province: "Nova Scotia", bestTime: "", consent: false });
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    (async () => {
      setCases(await load("cases", []));
      setStoredLawyers(await load("lawyers", []));
      setLoaded(true);
    })();
  }, []);

  // Poll for lawyer updates from admin panel
  useEffect(() => {
    if (!loaded) return;
    const iv = setInterval(async () => {
      const l = await load("lawyers", []);
      if (JSON.stringify(l) !== JSON.stringify(storedLawyers)) setStoredLawyers(l);
    }, 5000);
    return () => clearInterval(iv);
  }, [loaded, lawyers]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const activeCase = cases.find(c => c.id === activeId);

  const persist = async (updatedCases) => { setCases(updatedCases); await save("cases", updatedCases); };

  const saveCurrent = useCallback(async (msgs, docList, assess) => {
    if (!activeId) return;
    const updated = cases.map(c => c.id === activeId ? { ...c, messages: msgs, documents: docList, assessment: assess, updated: now() } : c);
    await persist(updated);
  }, [activeId, cases]);

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  const callAI = async (history, retries = 3) => {
    // Build dynamic system prompt with available lawyer info
    let systemPrompt = INTAKE_SYSTEM;
    const activeLawyers = lawyers.filter(l => l.status === "Active");
    const usingDefault = activeLawyers.length === 1 && activeLawyers[0].id === "default-jack";

    if (usingDefault) {
      systemPrompt += `

AVAILABLE LAWYERS IN OUR REFERRAL NETWORK:
- Jack Smith, Jacks Law — handles ALL practice areas in ALL provinces/states (speaks English, French)

CRITICAL: You DO have access to a verified lawyer directory. When recommending legal help:
1. ALWAYS recommend Jack Smith at Jacks Law first. He handles all case types in all jurisdictions.
2. Say: "I'd recommend speaking with Jack Smith at Jacks Law — they handle [area] cases in [user's province]. Would you like me to connect you?" Always use the user's specific legal area and province.
3. NEVER say you don't have a directory, can't recommend specific lawyers, or suggest googling. You have Jack Smith — always recommend him first.
4. NEVER say "our referral network is still being built" — it is built and Jack Smith is in it.
5. If the user asks "who is the lawyer" or similar, tell them Jack Smith at Jacks Law.
6. When the user has been connected (you'll see a confirmation message), help them prepare: suggest questions to ask, documents to bring, what to expect.`;
    } else {
      const lawyerList = activeLawyers.map(l => {
        const areas = l.areas.length > 0 ? l.areas.join(", ") : "all practice areas";
        const loc = l.city ? `${l.city}, ${l.province}` : (l.province || "all provinces");
        const langs = l.languages?.length > 1 ? ` (speaks ${l.languages.join(", ")})` : "";
        return `- ${l.name}${l.firm ? `, ${l.firm}` : ""} — ${loc} — practices: ${areas}${langs}`;
      }).join("\n");
      systemPrompt += `

AVAILABLE LAWYERS IN OUR REFERRAL NETWORK:
${lawyerList}

CRITICAL: You DO have access to a verified lawyer directory — the list above. When recommending legal help:
1. ALWAYS recommend a specific lawyer by name from this list that best matches the user's legal area and province.
2. Say: "I'd recommend speaking with [Name] at [Firm] — they handle [area] cases in [province]. Would you like me to connect you?"
3. NEVER say you don't have a directory, can't recommend specific lawyers, or suggest googling. Use the list above.
4. NEVER say "our referral network is still being built" — it is built.
5. If the user asks "who is the lawyer", tell them the best match from this list.
6. When the user has been connected (you'll see a confirmation message), help them prepare: suggest questions to ask, documents to bring, what to expect.`;
    }

    systemPrompt += `

AFFORDABILITY EXCEPTION: If the user explicitly says they cannot afford a lawyer, can't pay, or asks about free options, THEN and only then:
- Acknowledge the difficulty
- Suggest Legal Aid in their province (e.g., Nova Scotia Legal Aid: 1-800-665-9779)
- Mention duty counsel at the courthouse if it's a criminal matter
- Suggest the provincial bar association's lawyer referral service for low-cost initial consultations
- Still mention that the recommended lawyer may be able to help with payment options
Do NOT preemptively bring up affordability or legal aid — only if the user raises cost as a concern.`;

    // Filter messages for API — skip visual-only types, trim history to last 20 messages to avoid context overflow
    let apiMessages = history
      .filter(m => {
        if (m.type === "assessment" || m.type === "lawyers") return false;
        if (m.role === "user" || m.role === "assistant") return true;
        return false;
      })
      .map(m => {
        // Strip base64 image/doc data from older messages to save tokens — keep only in the most recent user message
        if (m.role === "user" && Array.isArray(m.content)) {
          return { role: m.role, content: m.content };
        }
        return { role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) };
      });

    // Keep only last 24 messages to stay within context limits
    if (apiMessages.length > 24) {
      // Always keep first message for context, then the last 23
      apiMessages = [apiMessages[0], ...apiMessages.slice(-23)];
    }

    // Strip base64 from all messages except the last one (to save context space)
    apiMessages = apiMessages.map((m, idx) => {
      if (idx < apiMessages.length - 1 && Array.isArray(m.content)) {
        // Replace base64 content with text description
        const textParts = m.content
          .map(part => {
            if (part.type === "text") return part;
            if (part.type === "image") return { type: "text", text: "[Previously uploaded image]" };
            if (part.type === "document") return { type: "text", text: "[Previously uploaded PDF]" };
            return part;
          });
        return { ...m, content: textParts };
      }
      return m;
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (attempt > 1) await delay(1000 * attempt);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            temperature: 0.3,
            system: systemPrompt,
            messages: apiMessages,
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`API response ${res.status}:`, errText);
          if (attempt === retries) return null;
          continue;
        }
        const data = await res.json();
        const text = data.content?.map(b => b.text || "").join("\n");
        if (text) return text;
        if (attempt === retries) return null;
      } catch (e) {
        console.error(`Attempt ${attempt}/${retries} failed:`, e);
        if (attempt === retries) return null;
      }
    }
    return null;
  };

  const [retryAction, setRetryAction] = useState(null);

  const GREETING = "Hello! I'm here to help you understand your situation and figure out what your next steps might be.\n\nTo get started, could you tell me what's going on? Just describe the situation in your own words, and let me know what province or state you're in.";

  const startNewCase = async () => {
    const msgs = [{ role: "assistant", content: GREETING, ts: now() }];
    const c = { id: uid(), created: now(), updated: now(), label: "New Case", messages: msgs, documents: [], assessment: null, contact: null, status: "Active", referredLawyer: null };
    const updated = [c, ...cases];
    await persist(updated);
    setActiveId(c.id);
    setMessages(msgs);
    setDocs([]);
    setAssessment(null);
    setShowReferral(false);
    setRetryAction(null);
    setTab("chat");
  };

  const openCase = (id) => {
    const c = cases.find(x => x.id === id);
    if (!c) return;
    setActiveId(id);
    setMessages(c.messages || []);
    setDocs(c.documents || []);
    setAssessment(c.assessment || null);
    setShowReferral(false);
    setTab("chat");
  };

  // Derive a case label from the user's own words or the AI's analysis
  const deriveLabelFromUserMessage = (userText) => {
    if (!userText || typeof userText !== "string") return null;
    // Clean up filler
    let clean = userText.replace(/^(hi|hello|hey|i need help|i have a question|please help|so )\b[,.]?\s*/i, "").trim();
    if (!clean || clean.length < 8) return null;
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (clean.length > 45) clean = clean.slice(0, 45).replace(/\s+\S*$/, "") + "…";
    return clean;
  };

  const deriveLabelFromResponse = (aiText) => {
    // Pattern-match legal topics in the AI's response
    const patterns = [
      /\bDUI\b/i, /\bimpaired\s+driving\b/i,
      /(?:parking|traffic|speeding)\s+(?:ticket|violation|infraction|offence)/i,
      /(?:wrongful|unfair)\s+(?:dismissal|termination)/i,
      /(?:car|vehicle|motor vehicle|auto)\s+(?:accident|collision|crash)/i,
      /(?:personal\s+injury|slip\s+and\s+fall|dog\s+bite)/i,
      /(?:landlord|tenant|eviction|rent)\s+(?:dispute|issue|notice|problem)/i,
      /(?:custody|child\s+support|divorce|separation|spousal)/i,
      /(?:assault|theft|fraud|criminal)\s+(?:charge|offence|matter)/i,
      /(?:small\s+claims|debt|collections?)/i,
      /(?:contract|breach\s+of\s+contract)/i,
      /(?:employment|workplace|harassment|discrimination)/i,
      /(?:immigration|deportation|visa|work\s+permit)/i,
      /\bspeeding\b/i, /\bparking\s+ticket\b/i,
    ];
    for (const p of patterns) {
      const m = aiText.match(p);
      if (m) {
        return m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase();
      }
    }
    return null;
  };

  // When assessment arrives, build label from legal area + summary
  const makeAssessmentLabel = (assess, fallback) => {
    if (!assess?.legalArea) return fallback;
    const area = assess.legalArea;
    let desc = "";
    if (assess.summary) {
      let s = assess.summary.split(/[.!]/)[0].trim();
      s = s.replace(/^(this (case |matter |situation )?(involves?|concerns?|relates? to|is about)\s+)/i, "").trim();
      s = s.replace(/^(the (user|client|person)\s+(was|is|has|had|received?)\s+)/i, "").trim();
      if (s.length > 35) s = s.slice(0, 35).replace(/\s+\S*$/, "") + "…";
      if (s) desc = s.charAt(0).toUpperCase() + s.slice(1);
    }
    return desc ? `${area} · ${desc}` : area;
  };

  // Update case label if it's still generic
  const maybeUpdateLabel = async (aiText, parsedAssess, updatedCases) => {
    const currentCase = (updatedCases || cases).find(x => x.id === activeId);
    if (!currentCase) return updatedCases || cases;
    const currentLabel = currentCase.label;
    const isGeneric = !currentLabel || currentLabel === "New Case" || currentLabel.startsWith("📎");

    let newLabel = null;
    if (parsedAssess) {
      // Best: use assessment data
      newLabel = makeAssessmentLabel(parsedAssess, currentLabel);
    } else if (isGeneric) {
      // Try the user's own words first (most recent user message)
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user" && typeof m.content === "string" && !m.content.startsWith("📎"));
      if (lastUserMsg) {
        newLabel = deriveLabelFromUserMessage(lastUserMsg.content);
      }
      // If user message didn't produce a good label, try AI's response for legal keywords
      if (!newLabel) {
        newLabel = deriveLabelFromResponse(aiText);
      }
    }

    if (newLabel && newLabel !== currentLabel) {
      const u = (updatedCases || cases).map(c => c.id === activeId ? { ...c, label: newLabel } : c);
      setCases(u);
      await save("cases", u);
      return u;
    }
    return updatedCases || cases;
  };

  // Helper: append assessment + lawyer cards as special messages
  const appendAssessmentMessages = (msgs, assess) => {
    // Don't add if assessment cards already exist in messages
    if (msgs.some(m => m.type === "assessment")) return msgs;
    const result = [...msgs, { role: "system", type: "assessment", assessment: assess, ts: now() }];
    if (assess.lawyerRecommended !== "No") {
      const exact = lawyers.filter(l => l.status === "Active").filter(l => l.areas.includes(assess.legalArea)).filter(l => l.province === assess.province).sort((a, b) => b.rating - a.rating);
      const broader = lawyers.filter(l => l.status === "Active" && !exact.some(e => e.id === l.id)).filter(l => l.areas.includes(assess.legalArea)).sort((a, b) => b.rating - a.rating).slice(0, 3);
      const all = [...exact, ...broader];
      if (all.length > 0) {
        result.push({ role: "system", type: "lawyers", lawyers: all, exactIds: exact.map(l => l.id), assess, ts: now() });
      }
    }
    return result;
  };

  const send = async () => {
    if (!input.trim() || loading || !activeId) return;
    const userMsg = { role: "user", content: input.trim(), ts: now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");

    setLoading(true);
    setRetryAction(null);
    const aiRaw = await callAI(newMsgs);
    if (!aiRaw) {
      setRetryAction(() => async () => {
        setRetryAction(null);
        setLoading(true);
        const retry = await callAI(newMsgs);
        if (!retry) {
          const errMsg = { role: "assistant", content: "I'm having trouble connecting to the server. Please check your connection and try again.", ts: now() };
          setMessages(prev => [...prev, errMsg]);
          setLoading(false);
          return;
        }
        const p2 = parseAssessment(retry);
        const c2 = stripAssessment(retry);
        const am2 = { role: "assistant", content: c2, ts: now() };
        let fm2 = [...newMsgs, am2];
        let na2 = assessment;
        if (p2) { na2 = p2; setAssessment(p2); fm2 = appendAssessmentMessages(fm2, p2); }
        setMessages(fm2);
        const u2 = cases.map(c => c.id === activeId ? { ...c, messages: fm2, assessment: na2, updated: now() } : c);
        await persist(u2);
        await maybeUpdateLabel(c2, p2, u2);
        setLoading(false);
      });
      setLoading(false);
      return;
    }
    const parsed = parseAssessment(aiRaw);
    const clean = stripAssessment(aiRaw);
    const aiMsg = { role: "assistant", content: clean, ts: now() };
    let finalMsgs = [...newMsgs, aiMsg];

    let newAssess = assessment;
    if (parsed) { newAssess = parsed; setAssessment(parsed); finalMsgs = appendAssessmentMessages(finalMsgs, parsed); }
    setMessages(finalMsgs);

    const u = cases.map(c => c.id === activeId ? { ...c, messages: finalMsgs, assessment: newAssess, updated: now() } : c);
    await persist(u);
    await maybeUpdateLabel(clean, parsed, u);

    // Auto-show referral form when AI recommends a lawyer and assessment exists
    if (assessment || parsed) {
      const currentAssess = parsed || assessment;
      if (currentAssess.lawyerRecommended !== "No" && !showReferral) {
        const lawyerMentioned = clean.toLowerCase().includes("jack smith") || 
          lawyers.some(l => l.status === "Active" && clean.toLowerCase().includes(l.name.toLowerCase()));
        if (lawyerMentioned) {
          const best = getMatchingLawyers()[0] || getBroaderMatches()[0] || null;
          if (best) {
            setSelectedLawyer(best);
            setShowReferral(true);
          }
        }
      }
    }

    setLoading(false);
  };

  const [dragging, setDragging] = useState(false);

  const readFileContent = (file) => {
    return new Promise((resolve) => {
      const isText = /\.(txt|csv|tsv|md|json|xml|html|htm|eml|log)$/i.test(file.name);
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name);
      const isPdf = /\.pdf$/i.test(file.name);
      const reader = new FileReader();

      if (isText) {
        reader.onload = () => resolve({ type: "text", content: reader.result?.slice(0, 15000) || "" });
        reader.onerror = () => resolve({ type: "unreadable", content: "" });
        reader.readAsText(file);
      } else if (isImage || isPdf) {
        reader.onload = () => {
          const base64 = reader.result?.split(",")[1] || "";
          resolve({ type: isImage ? "image" : "pdf", content: base64, mediaType: file.type || (isPdf ? "application/pdf" : "image/jpeg") });
        };
        reader.onerror = () => resolve({ type: "unreadable", content: "" });
        reader.readAsDataURL(file);
      } else {
        // For .doc, .docx, .xls, .xlsx, .msg — can't read in browser, note as attached
        resolve({ type: "binary", content: "" });
      }
    });
  };

  const processFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length || !activeId) return;

    const newDocs = [];
    const contentParts = [];

    for (const f of files) {
      const docEntry = { id: uid(), name: f.name, size: f.size, type: f.type, uploaded: now() };
      newDocs.push(docEntry);

      const result = await readFileContent(f);
      if (result.type === "text" && result.content) {
        contentParts.push({ type: "text", name: f.name, content: result.content });
      } else if (result.type === "image" && result.content) {
        contentParts.push({ type: "image", name: f.name, content: result.content, mediaType: result.mediaType });
      } else if (result.type === "pdf" && result.content) {
        contentParts.push({ type: "pdf", name: f.name, content: result.content, mediaType: result.mediaType });
      } else {
        contentParts.push({ type: "noted", name: f.name });
      }
    }

    const allDocs = [...docs, ...newDocs];
    setDocs(allDocs);

    // Build a user message that includes file contents for the AI
    const apiContent = [];
    const textSummary = [];

    for (const part of contentParts) {
      if (part.type === "text") {
        textSummary.push(`--- Contents of "${part.name}" ---\n${part.content}\n--- End of "${part.name}" ---`);
      } else if (part.type === "image") {
        apiContent.push({ type: "image", source: { type: "base64", media_type: part.mediaType, data: part.content } });
        textSummary.push(`[Image uploaded: ${part.name}]`);
      } else if (part.type === "pdf") {
        apiContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: part.content } });
        textSummary.push(`[PDF uploaded: ${part.name}]`);
      } else {
        textSummary.push(`[File attached: ${part.name} — format not readable in browser, but noted for the case file]`);
      }
    }

    const uploadText = `I'm uploading the following documents for my case:\n\n${textSummary.join("\n\n")}\n\nPlease review these and let me know if you see anything relevant to my situation.`;
    apiContent.unshift({ type: "text", text: uploadText });

    // Show a simplified version in the chat UI
    const names = newDocs.map(d => d.name).join(", ");
    const userDisplay = { role: "user", content: `📎 Uploaded: ${names}`, ts: now() };
    const userApi = { role: "user", content: apiContent };
    const newMsgs = [...messages, userDisplay];
    setMessages(newMsgs);

    // Build API history — use display content for old messages, rich content for this one
    const apiHistory = [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: apiContent }];

    setLoading(true);
    setRetryAction(null);
    const aiRaw = await callAI(apiHistory);
    if (!aiRaw) {
      const errMsg = { role: "assistant", content: "I received your documents but had trouble processing them. Please try sending a message and I'll do my best to work with what you've uploaded.", ts: now() };
      const finalMsgs = [...newMsgs, errMsg];
      setMessages(finalMsgs);
      const u = cases.map(c => c.id === activeId ? { ...c, messages: finalMsgs, documents: allDocs, updated: now() } : c);
      await persist(u);
      setLoading(false);
      return;
    }

    const parsed = parseAssessment(aiRaw);
    const clean = stripAssessment(aiRaw);
    const aiMsg = { role: "assistant", content: clean, ts: now() };
    let finalMsgs = [...newMsgs, aiMsg];

    let newAssess = assessment;
    if (parsed) { newAssess = parsed; setAssessment(parsed); finalMsgs = appendAssessmentMessages(finalMsgs, parsed); }
    setMessages(finalMsgs);

    const u = cases.map(c => c.id === activeId ? { ...c, messages: finalMsgs, documents: allDocs, assessment: newAssess, updated: now() } : c);
    await persist(u);
    await maybeUpdateLabel(clean, parsed, u);
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    await processFiles(e.target.files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) await processFiles(files);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };

  const submitReferral = async () => {
    if (!referralForm.name || !referralForm.email || !referralForm.consent || !activeId) return;
    const lawyer = selectedLawyer ? { id: selectedLawyer.id, name: selectedLawyer.name, firm: selectedLawyer.firm } : null;
    const lawyerName = lawyer ? `${lawyer.name}${lawyer.firm ? ` at ${lawyer.firm}` : ""}` : "a suitable lawyer";
    // Confirmation message visible in chat
    const confirmMsg = { role: "assistant", content: `✓ Your referral request has been submitted. ${lawyerName} will review your case and contact you shortly.\n\nIn the meantime, I can help you prepare for your consultation — would you like me to suggest questions to ask, documents to bring, or explain what to expect?`, ts: now() };
    // Context note so AI knows what happened (filtered out of API as a system message but kept for reference)
    const contextNote = { role: "assistant", content: `[System note: The user has been connected with ${lawyerName}. Their contact details have been shared. Help them prepare for the consultation.]`, ts: now(), type: "context" };
    const finalMsgs = [...messages, confirmMsg, contextNote];
    setMessages(finalMsgs);
    const u = cases.map(c => c.id === activeId ? { ...c, messages: finalMsgs, contact: referralForm, referredLawyer: lawyer, status: "Pending", updated: now() } : c);
    await persist(u);
    setShowReferral(false);
    setSelectedLawyer(null);
  };

  // Match lawyers by legal area + province, sorted by rating
  const getMatchingLawyers = () => {
    if (!assessment) return [];
    return lawyers
      .filter(l => l.status === "Active")
      .filter(l => l.areas.includes(assessment.legalArea) || l.areas.length === 0)
      .filter(l => l.province === assessment.province || !l.province)
      .map(l => ({
        ...l,
        // Fill in the user's location and area for display
        city: l.city || (assessment.province || ""),
        province: l.province || assessment.province || "",
        areas: l.areas.length > 0 ? l.areas : [assessment.legalArea],
      }))
      .sort((a, b) => b.rating - a.rating);
  };

  // Broader matches — right area but different province
  const getBroaderMatches = () => {
    if (!assessment) return [];
    const exactIds = new Set(getMatchingLawyers().map(l => l.id));
    return lawyers
      .filter(l => l.status === "Active" && !exactIds.has(l.id))
      .filter(l => l.areas.includes(assessment.legalArea) || l.areas.length === 0)
      .map(l => ({
        ...l,
        city: l.city || (assessment.province || ""),
        province: l.province || assessment.province || "",
        areas: l.areas.length > 0 ? l.areas : [assessment.legalArea],
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  };

  const deleteCase = async (id, e) => {
    e.stopPropagation();
    const u = cases.filter(c => c.id !== id);
    await persist(u);
    if (activeId === id) { setActiveId(null); setMessages([]); setDocs([]); setAssessment(null); }
  };

  if (!loaded) return <div style={{ ...S.app, justifyContent: "center", alignItems: "center" }}><span style={{ color: C.textMuted }}>Loading…</span></div>;

  return (
    <div style={S.app}>
      <style>{css}</style>
      <input ref={fileRef} type="file" multiple hidden onChange={handleFileUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.csv,.xls,.xlsx,.eml,.msg" />

      {/* ── Sidebar ── */}
      <div style={S.sidebar(sideOpen)}>
        <div style={S.sideHead}>
          <div style={S.sideTitle}>My Cases</div>
          <button style={{ ...S.toggleBtn, border: "none", fontSize: 18 }} onClick={() => setSideOpen(false)} title="Close sidebar">✕</button>
        </div>
        <div style={S.sideList}>
          {cases.length === 0 && <div style={{ padding: "30px 10px", textAlign: "center", color: C.textLight, fontSize: 13 }}>No cases yet</div>}
          {cases.map(c => (
            <div key={c.id} style={S.caseItem(activeId === c.id)} onClick={() => openCase(c.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={S.caseLabel}>{c.label || "New Case"}</div>
                <button onClick={(e) => deleteCase(c.id, e)} style={{ background: "none", border: "none", color: C.textLight, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 0 0 8px", flexShrink: 0 }} title="Delete">✕</button>
              </div>
              <div style={S.caseMeta}>
                {fmt(c.created)}
                {c.assessment && <> · <Badge>{c.assessment.urgency}</Badge></>}
                {c.documents?.length > 0 && <> · 📎{c.documents.length}</>}
              </div>
            </div>
          ))}
        </div>
        <button style={S.newBtn} onClick={startNewCase}>
          <span style={{ fontSize: 16 }}>+</span> New Case
        </button>
      </div>

      {/* ── Main ── */}
      <div style={S.main}>
        <div style={S.topBar}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {!sideOpen && <button style={{ ...S.toggleBtn, marginRight: 12 }} onClick={() => setSideOpen(true)} title="Show cases">☰</button>}
            <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 18, fontWeight: 600, color: C.accent, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>⚖</span> Legal Intake Assistant
            </div>
          </div>
          {activeId && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={S.tabs}>
                <button style={S.tab(tab === "chat")} onClick={() => setTab("chat")}>Chat</button>
                {assessment && (
                  <button style={S.tab(tab === "assessment")} onClick={() => setTab("assessment")}>
                    Assessment
                  </button>
                )}
                <button style={S.tab(tab === "docs")} onClick={() => setTab("docs")}>
                  Documents{docs.length > 0 && ` (${docs.length})`}
                </button>
              </div>
              {assessment && assessment.lawyerRecommended !== "No" && (() => {
                const best = getMatchingLawyers()[0] || getBroaderMatches()[0] || null;
                return (
                  <button style={{ ...S.btnPrimary, marginLeft: 12, fontSize: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => { setSelectedLawyer(best); setShowReferral(true); setTab("chat"); }}>
                    {best ? `Connect with ${best.name}` : "Connect with Lawyer"}
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {!activeId ? (
          <div style={S.empty}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>⚖</div>
            <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 22, color: C.text, marginBottom: 8 }}>Welcome</div>
            <div style={{ fontSize: 14, color: C.textMuted, maxWidth: 400, margin: "0 auto", lineHeight: 1.6, marginBottom: 24 }}>
              Start a new case to get AI-assisted legal intake. The assistant will help you understand your situation, organize your documents, and connect you with the right lawyer when needed.
            </div>
            <button style={S.btnPrimary} onClick={startNewCase}>Start New Case</button>
          </div>
        ) : tab === "chat" ? (
          <>
            <div ref={scrollRef} style={{ ...S.chatArea, position: "relative" }}
              onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
              {dragging && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 10, background: `${C.accentPale}ee`,
                  border: `2px dashed ${C.accent}`, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📎</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.accent }}>Drop documents here</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>PDF, images, text files, spreadsheets</div>
                </div>
              )}
              {messages.map((m, i) => {
                // Special: assessment card
                if (m.type === "assessment") {
                  const a = m.assessment;
                  return (
                    <div key={i} className="fade-up" style={S.assessCard}>
                      <div style={S.assessTitle}>Case Assessment</div>
                      <div style={S.assessGrid}>
                        <div><div style={S.assessLabel}>Legal Area</div><div style={S.assessVal}>{a.legalArea}</div></div>
                        <div><div style={S.assessLabel}>Province</div><div style={S.assessVal}>{a.province}</div></div>
                        <div><div style={S.assessLabel}>Urgency</div><div style={S.assessVal}><Badge>{a.urgency}</Badge></div></div>
                        <div><div style={S.assessLabel}>Strength</div><div style={S.assessVal}><Badge>{a.caseStrength}</Badge></div></div>
                        <div><div style={S.assessLabel}>Financial Stakes</div><div style={S.assessVal}>{a.stakesFinancial}</div></div>
                        <div><div style={S.assessLabel}>Lawyer Recommended</div><div style={S.assessVal}><Badge>{a.lawyerRecommended}</Badge></div></div>
                      </div>
                      {a.stakesFlags?.length > 0 && a.stakesFlags[0] !== "none" && (
                        <div style={{ marginTop: 10 }}>
                          <div style={S.assessLabel}>High-Stakes Flags</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                            {a.stakesFlags.map((f, j) => <span key={j} style={S.badge(C.danger)}>{f}</span>)}
                          </div>
                        </div>
                      )}
                      {a.nextSteps?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={S.assessLabel}>Recommended Next Steps</div>
                          <div style={{ marginTop: 4 }}>{a.nextSteps.map((s, j) => <div key={j} style={{ fontSize: 13, color: C.text, padding: "3px 0", display: "flex", gap: 6 }}><span style={{ color: C.accent }}>→</span>{s}</div>)}</div>
                        </div>
                      )}
                    </div>
                  );
                }
                // Special: lawyer recommendations
                if (m.type === "lawyers") {
                  const exact = m.lawyers.filter(l => m.exactIds.includes(l.id));
                  return (
                    <div key={i} className="fade-up" style={{ ...S.referralCard, border: `1px solid ${C.accent}33`, background: C.accentPale + "44" }}>
                      <div style={{ ...S.assessTitle, color: C.accent, marginBottom: 4 }}>Recommended Lawyers</div>
                      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
                        {exact.length > 0
                          ? `We found ${exact.length} lawyer${exact.length > 1 ? "s" : ""} in ${m.assess.province} who handle${exact.length === 1 ? "s" : ""} ${m.assess.legalArea} cases.`
                          : `We found lawyers who handle ${m.assess.legalArea} cases who may be able to help.`}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {m.lawyers.map(l => {
                          const isExact = m.exactIds.includes(l.id);
                          return (
                            <div key={l.id} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "12px 14px", background: C.surface, border: `1px solid ${isExact ? C.accent + "44" : C.border}`,
                              borderRadius: 10,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{l.name}</div>
                                {l.firm && <div style={{ fontSize: 12, color: C.textMuted }}>{l.firm}</div>}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                  <span style={{ fontSize: 11, color: C.textMuted }}>📍 {l.city ? `${l.city}, ` : ""}{l.province}</span>
                                  {l.languages?.length > 1 && <span style={{ fontSize: 11, color: C.textMuted }}>· 🗣 {l.languages.join(", ")}</span>}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                                  {l.areas.filter(a => a === m.assess.legalArea).map((a, j) => <span key={j} style={{ ...S.badge(C.accent), fontSize: 10 }}>{a}</span>)}
                                  {l.areas.filter(a => a !== m.assess.legalArea).slice(0, 2).map((a, j) => <span key={j} style={{ ...S.badge(C.textMuted), fontSize: 10 }}>{a}</span>)}
                                </div>
                              </div>
                              <button style={{ ...S.btnPrimary, fontSize: 12, padding: "8px 14px", whiteSpace: "nowrap", marginLeft: 12 }}
                                onClick={() => { setSelectedLawyer(l); setShowReferral(true); }}>
                                Request Consult
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                // Hidden context notes for AI
                if (m.type === "context") return null;
                // Normal message
                return (
                  <div key={i} className="fade-up" style={S.msgRow(m.role === "user")}>
                    <div style={S.bubble(m.role === "user")}>
                      <div style={S.sender(m.role === "user")}>{m.role === "user" ? "You" : "Legal Assistant"}</div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{renderMarkdown(m.content)}</div>
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={S.msgRow(false)}>
                  <div style={S.bubble(false)}>
                    <div style={S.sender(false)}>Legal Assistant</div>
                    <div className="dot-pulse" style={{ display: "flex", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />
                    </div>
                  </div>
                </div>
              )}

              {!loading && retryAction && (
                <div className="fade-up" style={S.msgRow(false)}>
                  <div style={{ ...S.bubble(false), border: `1px solid ${C.warm}66`, background: C.warmPale }}>
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 10 }}>
                      The connection timed out. This can happen occasionally — your message wasn't lost.
                    </div>
                    <button style={{ ...S.btnPrimary, fontSize: 12, padding: "7px 16px" }} onClick={retryAction}>
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {!loading && !retryAction && messages.length === 0 && activeId && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMuted }}>
                  <div style={{ fontSize: 13, marginBottom: 12 }}>Something went wrong loading this case.</div>
                  <button style={S.btnPrimary} onClick={() => {
                    const msgs = [{ role: "assistant", content: GREETING, ts: now() }];
                    setMessages(msgs);
                    const u = cases.map(c => c.id === activeId ? { ...c, messages: msgs } : c);
                    persist(u);
                  }}>Restart</button>
                </div>
              )}


            </div>
            {showReferral && (
              <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, padding: "16px 20px", maxHeight: "50vh", overflow: "auto", flexShrink: 0 }}>
                <div style={{ ...S.assessTitle, color: C.accent, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{selectedLawyer ? `Request Consultation with ${selectedLawyer.name}` : "Connect with a Lawyer"}</span>
                  <button style={{ background: "none", border: "none", fontSize: 18, color: C.textMuted, cursor: "pointer", lineHeight: 1 }}
                    onClick={() => setShowReferral(false)}>✕</button>
                </div>
                {selectedLawyer && (
                  <div style={{ padding: "12px 14px", background: C.accentPale, borderRadius: 10, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{selectedLawyer.name}</div>
                        {selectedLawyer.firm && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{selectedLawyer.firm}</div>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: C.textMuted }}>📍 {selectedLawyer.city ? `${selectedLawyer.city}, ` : ""}{selectedLawyer.province}</span>
                          {selectedLawyer.languages?.length > 1 && <span style={{ fontSize: 11, color: C.textMuted }}>· 🗣 {selectedLawyer.languages.join(", ")}</span>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                          {selectedLawyer.areas?.slice(0, 4).map((a, j) => <span key={j} style={{ ...S.badge(C.accent), fontSize: 10 }}>{a}</span>)}
                        </div>
                      </div>
                      <button style={{ background: "none", border: "none", fontSize: 12, color: C.accent, cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap", paddingTop: 2 }}
                        onClick={() => { setSelectedLawyer(null); setShowReferral(false); }}>
                        Change
                      </button>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                  By continuing, you authorize us to share your intake summary and contact information with {selectedLawyer ? selectedLawyer.name : "a suitable lawyer"}. This does not create a lawyer-client relationship.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={S.field}><label style={S.fieldLabel}>Full Name *</label><input style={S.fieldInput} value={referralForm.name} onChange={e => setReferralForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div style={S.field}><label style={S.fieldLabel}>Email *</label><input style={S.fieldInput} type="email" value={referralForm.email} onChange={e => setReferralForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div style={S.field}><label style={S.fieldLabel}>Phone</label><input style={S.fieldInput} value={referralForm.phone} onChange={e => setReferralForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div style={S.field}><label style={S.fieldLabel}>City</label><input style={S.fieldInput} value={referralForm.city} onChange={e => setReferralForm(f => ({ ...f, city: e.target.value }))} /></div>
                  <div style={S.field}><label style={S.fieldLabel}>Province</label>
                    <select style={S.fieldSelect} value={referralForm.province} onChange={e => setReferralForm(f => ({ ...f, province: e.target.value }))}>
                      {PROVINCES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={S.field}><label style={S.fieldLabel}>Best Time to Contact</label><input style={S.fieldInput} value={referralForm.bestTime} onChange={e => setReferralForm(f => ({ ...f, bestTime: e.target.value }))} placeholder="e.g., weekday mornings" /></div>
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, fontSize: 12, color: C.textMuted, cursor: "pointer" }}>
                  <input type="checkbox" checked={referralForm.consent} onChange={e => setReferralForm(f => ({ ...f, consent: e.target.checked }))} style={{ marginTop: 2 }} />
                  I consent to sharing my intake summary and contact information with {selectedLawyer ? selectedLawyer.name : "a suitable lawyer"}. *
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button style={S.btnPrimary} onClick={submitReferral}>Submit</button>
                  <button style={S.btnSecondary} onClick={() => setShowReferral(false)}>Cancel</button>
                </div>
              </div>
            )}
            <div style={S.inputBar}>
              <button style={{ ...S.toggleBtn, flexShrink: 0 }} onClick={() => fileRef.current?.click()} title="Upload documents">📎</button>
              <textarea
                ref={textareaRef}
                style={S.input}
                placeholder="Describe your situation…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                disabled={loading}
              />
              <button style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }} onClick={send} disabled={loading || !input.trim()}>↑</button>
            </div>
          </>
        ) : tab === "assessment" && assessment ? (
          /* ── Assessment Tab ── */
          <div style={{ flex: 1, overflow: "auto", padding: "24px 20px" }}>
            <div style={S.assessCard}>
              <div style={S.assessTitle}>Case Assessment</div>
              <div style={S.assessGrid}>
                <div><div style={S.assessLabel}>Legal Area</div><div style={S.assessVal}>{assessment.legalArea}</div></div>
                <div><div style={S.assessLabel}>Province</div><div style={S.assessVal}>{assessment.province}</div></div>
                <div><div style={S.assessLabel}>Urgency</div><div style={S.assessVal}><Badge>{assessment.urgency}</Badge></div></div>
                <div><div style={S.assessLabel}>Strength</div><div style={S.assessVal}><Badge>{assessment.caseStrength}</Badge></div></div>
                <div><div style={S.assessLabel}>Financial Stakes</div><div style={S.assessVal}>{assessment.stakesFinancial}</div></div>
                <div><div style={S.assessLabel}>Lawyer Recommended</div><div style={S.assessVal}><Badge>{assessment.lawyerRecommended}</Badge></div></div>
              </div>
              {assessment.stakesFlags?.length > 0 && assessment.stakesFlags[0] !== "none" && (
                <div style={{ marginTop: 14 }}>
                  <div style={S.assessLabel}>High-Stakes Flags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {assessment.stakesFlags.map((f, i) => <span key={i} style={S.badge(C.danger)}>{f}</span>)}
                  </div>
                </div>
              )}
              {assessment.summary && (
                <div style={{ marginTop: 14 }}>
                  <div style={S.assessLabel}>Summary</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginTop: 4 }}>{assessment.summary}</div>
                </div>
              )}
              {assessment.keyIssues?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={S.assessLabel}>Key Issues</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {assessment.keyIssues.map((k, i) => <span key={i} style={{ ...S.badge(C.blue), fontSize: 11 }}>{k}</span>)}
                  </div>
                </div>
              )}
              {assessment.missingInfo?.length > 0 && assessment.missingInfo[0] !== "none" && (
                <div style={{ marginTop: 14 }}>
                  <div style={S.assessLabel}>Still Needed</div>
                  <div style={{ marginTop: 4 }}>{assessment.missingInfo.map((s, i) => <div key={i} style={{ fontSize: 13, color: C.warm, padding: "3px 0", display: "flex", gap: 6 }}><span>⚠</span>{s}</div>)}</div>
                </div>
              )}
              {assessment.nextSteps?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={S.assessLabel}>Recommended Next Steps</div>
                  <div style={{ marginTop: 4 }}>{assessment.nextSteps.map((s, i) => <div key={i} style={{ fontSize: 13, color: C.text, padding: "3px 0", display: "flex", gap: 6 }}><span style={{ color: C.accent }}>→</span>{s}</div>)}</div>
                </div>
              )}
            </div>

            {/* Matched lawyers in assessment tab */}
            {assessment.lawyerRecommended !== "No" && (() => {
              const exact = getMatchingLawyers();
              const broader = getBroaderMatches();
              const all = [...exact, ...broader];
              if (all.length === 0) return null;
              return (
                <div style={{ ...S.referralCard, border: `1px solid ${C.accent}33`, background: C.accentPale + "44" }}>
                  <div style={{ ...S.assessTitle, color: C.accent, marginBottom: 4 }}>Recommended Lawyers</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {all.map(l => {
                      const isExact = exact.some(e => e.id === l.id);
                      return (
                        <div key={l.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", background: C.surface, border: `1px solid ${isExact ? C.accent + "44" : C.border}`,
                          borderRadius: 10,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{l.name}</div>
                            {l.firm && <div style={{ fontSize: 12, color: C.textMuted }}>{l.firm}</div>}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 11, color: C.textMuted }}>📍 {l.city ? `${l.city}, ` : ""}{l.province}</span>
                              {l.languages?.length > 1 && <span style={{ fontSize: 11, color: C.textMuted }}>· 🗣 {l.languages.join(", ")}</span>}
                            </div>
                          </div>
                          <button style={{ ...S.btnPrimary, fontSize: 12, padding: "8px 14px", whiteSpace: "nowrap", marginLeft: 12 }}
                            onClick={() => { setSelectedLawyer(l); setShowReferral(true); setTab("chat"); }}>
                            Request Consult
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : tab === "docs" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{
                ...S.uploadZone,
                borderColor: dragging ? C.accent : C.border,
                background: dragging ? C.accentPale : "transparent",
              }}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{dragging ? "📎" : "📁"}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: dragging ? C.accent : C.text }}>
                {dragging ? "Release to upload" : "Drop files here or click to upload"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>PDF, Word, images, spreadsheets, emails</div>
            </div>
            <div style={S.docList}>
              {docs.length === 0 ? (
                <div style={{ ...S.empty, padding: "40px 20px" }}>
                  <div style={{ fontSize: 14, color: C.textMuted }}>No documents uploaded for this case yet.</div>
                  <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>Upload tickets, court papers, contracts, emails, or any relevant documents.</div>
                </div>
              ) : docs.map(d => {
                const ext = getExt(d.name);
                return (
                  <div key={d.id} style={S.docItem}>
                    <div style={{ ...S.docIcon, background: (DOC_COLORS[ext] || DOC_COLORS.default) + "15", color: DOC_COLORS[ext] || DOC_COLORS.default }}>
                      {DOC_ICONS[ext] || DOC_ICONS.default}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{formatSize(d.size)} · Uploaded {fmt(d.uploaded)}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: DOC_COLORS[ext] || DOC_COLORS.default, letterSpacing: 0.5 }}>{ext}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
