import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

const API = "http://127.0.0.1:8000";

const PRESETS = [
  "create 3 beams IPE300 S275",
  "create 2 columns HEB200 S355",
  "delete all unknown members",
  "list all profiles",
];

const QUICK_Q = [
  "How many columns?",
  "List all unique profiles",
  "Most used material?",
  "Average beam length?",
];

export default function App() {
  const [summary, setSummary]   = useState(null);
  const [members, setMembers]   = useState([]);
  const [filter, setFilter]     = useState("all");
  const [online, setOnline]     = useState(false);
  const [tab, setTab]           = useState("chat");      // "chat" | "agent"
  const [msgs, setMsgs]         = useState([
    { role: "ai", text: "Model load hone ke baad yahan questions puchh sakte ho." },
  ]);
  const [chatIn, setChatIn]     = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [agentIn, setAgentIn]   = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentLog, setAgentLog] = useState(null);
  const chatRef = useRef(null);

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [msgs]);

  async function loadData() {
    try {
      const r = await axios.get(`${API}/model-data`);
      if (r.data.status !== "success") { setOnline(false); return; }
      setOnline(true);
      setSummary(r.data.summary);
      const st = r.data.structured;
      setMembers([
        ...st.PRIMARY_COLUMN.map(m => ({ ...m, _role: "COLUMN" })),
        ...st.PRIMARY_BEAM.map(m   => ({ ...m, _role: "BEAM" })),
        ...st.SECONDARY.map(m      => ({ ...m, _role: "SECONDARY" })),
        ...st.UNKNOWN.map(m        => ({ ...m, _role: "UNKNOWN" })),
      ]);
    } catch { setOnline(false); }
  }

  async function sendChat() {
    const msg = chatIn.trim();
    if (!msg || chatBusy) return;
    setChatIn(""); setChatBusy(true);
    setMsgs(p => [...p, { role: "user", text: msg }, { role: "typing" }]);
    try {
      const r = await axios.post(`${API}/query`, { message: msg });
      setMsgs(p => [...p.filter(x => x.role !== "typing"), { role: "ai", text: r.data.response || r.data.message }]);
    } catch {
      setMsgs(p => [...p.filter(x => x.role !== "typing"), { role: "ai", text: "FastAPI se connect nahi hua." }]);
    }
    setChatBusy(false);
  }

  async function runAgent() {
    const cmd = agentIn.trim();
    if (!cmd || agentBusy) return;
    setAgentBusy(true); setAgentLog(null);
    try {
      const r = await axios.post(`${API}/agent`, { command: cmd });
      setAgentLog({ ok: true, data: r.data });
      loadData();
    } catch (e) {
      setAgentLog({ ok: false, data: e?.response?.data || { message: "Server error" } });
    }
    setAgentBusy(false);
  }

  const filtered = filter === "all" ? members : members.filter(m => m._role === filter);
  const maxV = summary ? Math.max(summary.columns, summary.beams, summary.secondary, summary.unknown, 1) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header className="hdr">
        <span className="hdr-logo">TEKLA<span>/</span>AI <span>structural dashboard</span></span>
        <div className="status-pill">
          <div className={`dot ${online ? "on" : ""}`} />
          <span>{online ? "connected" : "offline — start uvicorn"}</span>
        </div>
      </header>

      <div className="layout">
        {/* ── LEFT ── */}
        <div className="main">
          {/* Cards */}
          <div className="cards">
            {[
              { l: "Total",     v: summary?.total },
              { l: "Columns",   v: summary?.columns },
              { l: "Beams",     v: summary?.beams },
              { l: "Secondary", v: summary?.secondary },
              { l: "Unknown",   v: summary?.unknown },
            ].map(c => (
              <div className="card" key={c.l}>
                <div className="card-label">{c.l}</div>
                <div className="card-value">{c.v ?? "—"}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="panel">
            <div className="panel-head">
              <span>Distribution</span>
              <button className="btn-sm" onClick={loadData}>↻ Refresh</button>
            </div>
            <div className="chart">
              {summary && [
                { l: "Columns",   v: summary.columns },
                { l: "Beams",     v: summary.beams },
                { l: "Secondary", v: summary.secondary },
                { l: "Unknown",   v: summary.unknown },
              ].map(b => (
                <div className="bar-col" key={b.l}>
                  <span className="bar-val">{b.v}</span>
                  <div className="bar-fill" style={{ height: Math.max(4, (b.v / maxV) * 64) }} />
                  <span className="bar-lbl">{b.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="panel" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="panel-head">
              <span>Members ({filtered.length})</span>
              <div style={{ display: "flex", gap: 5 }}>
                {["all", "COLUMN", "BEAM", "SECONDARY", "UNKNOWN"].map(f => (
                  <button key={f} className={`btn-sm ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                    {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>{["ID", "GUID", "Role", "Profile", "Material", "Name", "Length mm"].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((m, i) => {
                    const geo = m.Geometry || m.geometry || {};
                    const len = geo.Length != null ? Math.round(geo.Length) : "—";
                    const guid = (m.Guid || m.guid || "").substring(0, 8);
                    return (
                      <tr key={i}>
                        <td className="mono">{m.Id ?? m.id ?? "—"}</td>
                        <td className="mono">{guid ? guid + "…" : "—"}</td>
                        <td><span className={`badge ${m._role.toLowerCase()}`}> {m._role}</span></td>
                        <td className="mono">{m.Profile ?? m.profile ?? "—"}</td>
                        <td className="mono">{m.Material ?? m.material ?? "—"}</td>
                        <td>{m.Name ?? m.name ?? "—"}</td>
                        <td className="mono" style={{ textAlign: "right" }}>{len}</td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No members</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="right">
          <div className="tabs">
            <div className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>AI Query</div>
            <div className={`tab ${tab === "agent" ? "active" : ""}`} onClick={() => setTab("agent")}>Creation Agent</div>
          </div>

          {/* Chat tab */}
          {tab === "chat" && <>
            <div className="quick-qs">
              {QUICK_Q.map(q => <button key={q} className="btn-sm" onClick={() => setChatIn(q)}>{q}</button>)}
            </div>
            <div className="chat-msgs" ref={chatRef}>
              {msgs.map((m, i) => m.role === "typing"
                ? <div key={i} className="msg-ai"><div className="ai-lbl">Tekla AI</div><div className="typing"><span/><span/><span/></div></div>
                : m.role === "user"
                  ? <div key={i} className="msg-user">{m.text}</div>
                  : <div key={i} className="msg-ai"><div className="ai-lbl">Tekla AI</div><span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span></div>
              )}
            </div>
            <div className="input-row">
              <textarea value={chatIn} onChange={e => setChatIn(e.target.value)} rows={2} placeholder="Ask about the structure..."
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button className="send-btn" onClick={sendChat} disabled={chatBusy}>Send</button>
            </div>
          </>}

          {/* Agent tab */}
          {tab === "agent" && <>
            <div className="agent-body">
              <div>
                <div className="section-lbl">Presets</div>
                <div className="agent-preset">
                  {PRESETS.map(p => <button key={p} className="btn-sm" onClick={() => setAgentIn(p)}>{p}</button>)}
                </div>
              </div>
              <div>
                <div className="section-lbl">How to use</div>
                <div className="agent-result">
{`create N [BEAM|COLUMN] [profile] [material]
  e.g. create 3 beams IPE300 S275
  e.g. create 2 columns HEB200 S355

delete [all] [role] members
  e.g. delete all unknown members

list [all] profiles
suggest optimal sections`}
                </div>
              </div>
              {agentLog && (
                <div>
                  <div className="section-lbl">Result</div>
                  <div className={`agent-result ${agentLog.ok ? "ok" : "err"}`}>
                    {JSON.stringify(agentLog.data, null, 2)}
                  </div>
                </div>
              )}
            </div>
            <div className="agent-input-wrap">
              <input className="agent-input" value={agentIn} onChange={e => setAgentIn(e.target.value)}
                placeholder="e.g. create 5 beams IPE300 S275"
                onKeyDown={e => { if (e.key === "Enter") runAgent(); }} />
              <button className="full-btn" onClick={runAgent} disabled={agentBusy}>
                {agentBusy ? "Running…" : "Execute Command"}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}