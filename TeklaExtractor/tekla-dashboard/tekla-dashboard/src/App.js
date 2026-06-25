import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

/* ── ROLE METADATA ── */
const ROLE_META = {
  COLUMN:     { color:"#1D4ED8", label:"Columns" },
  BEAM:       { color:"#B45309", label:"Beams" },
  SECONDARY:  { color:"#475569", label:"Secondary" },
  CONNECTION: { color:"#6D28D9", label:"Connections" },
  UNKNOWN:    { color:"#B91C1C", label:"Unknown" },
};

const KPI_DEFS = [
  { key:"total",       label:"Total Members", stripe:"#1D4ED8" },
  { key:"columns",     label:"Columns",       stripe:"#1D4ED8" },
  { key:"beams",       label:"Beams",         stripe:"#B45309" },
  { key:"secondary",   label:"Secondary",     stripe:"#475569" },
  { key:"connections", label:"Connections",   stripe:"#6D28D9" },
  { key:"drawings",    label:"Drawings",      stripe:"#0891B2" },
];

/* ── DEMO DATA ── */
const DEMO_MEMBERS = [
  { id:"COL-01", role:"COLUMN",    profile:"HEA200", material:"S355", length:4000, weight:612,  x:0,    y:0,    z:0,    x2:0,    y2:0,    z2:4000, drawing:"GA-101" },
  { id:"COL-02", role:"COLUMN",    profile:"HEA200", material:"S355", length:4000, weight:612,  x:6000, y:0,    z:0,    x2:6000, y2:0,    z2:4000, drawing:"GA-101" },
  { id:"COL-03", role:"COLUMN",    profile:"HEA300", material:"S355", length:4000, weight:880,  x:0,    y:6000, z:0,    x2:0,    y2:6000, z2:4000, drawing:"GA-101" },
  { id:"COL-04", role:"COLUMN",    profile:"HEA200", material:"S355", length:4000, weight:612,  x:6000, y:6000, z:0,    x2:6000, y2:6000, z2:4000, drawing:"GA-101" },
  { id:"COL-05", role:"COLUMN",    profile:"HEA300", material:"S355", length:3600, weight:792,  x:3000, y:0,    z:0,    x2:3000, y2:0,    z2:3600, drawing:"GA-101" },
  { id:"COL-06", role:"COLUMN",    profile:"HEA200", material:"S355", length:4000, weight:612,  x:3000, y:6000, z:0,    x2:3000, y2:6000, z2:4000, drawing:"GA-101" },
  { id:"BM-01",  role:"BEAM",      profile:"IPE300", material:"S355", length:6000, weight:252,  x:0,    y:0,    z:4000, x2:6000, y2:0,    z2:4000, drawing:"GA-102" },
  { id:"BM-02",  role:"BEAM",      profile:"IPE300", material:"S275", length:6000, weight:252,  x:0,    y:6000, z:4000, x2:6000, y2:6000, z2:4000, drawing:"GA-102" },
  { id:"BM-03",  role:"BEAM",      profile:"IPE400", material:"",     length:6000, weight:372,  x:0,    y:0,    z:4000, x2:0,    y2:6000, z2:4000, drawing:"GA-102" },
  { id:"BM-04",  role:"BEAM",      profile:"IPE300", material:"S355", length:6000, weight:252,  x:6000, y:0,    z:4000, x2:6000, y2:6000, z2:4000, drawing:"GA-102" },
  { id:"BM-05",  role:"BEAM",      profile:"IPE360", material:"S355", length:3000, weight:165,  x:3000, y:0,    z:3600, x2:3000, y2:0,    z2:4000, drawing:"GA-102" },
  { id:"BM-06",  role:"BEAM",      profile:"IPE400", material:"S355", length:6000, weight:440,  x:0,    y:3000, z:4000, x2:6000, y2:3000, z2:4000, drawing:"GA-103" },
  { id:"SEC-01", role:"SECONDARY", profile:"L100x10",material:"S235", length:7071, weight:110,  x:0,    y:0,    z:0,    x2:3000, y2:0,    z2:3600, drawing:"GA-103" },
  { id:"SEC-02", role:"SECONDARY", profile:"L100x10",material:"S235", length:7071, weight:110,  x:6000, y:0,    z:0,    x2:3000, y2:0,    z2:3600, drawing:"GA-103" },
  { id:"SEC-03", role:"SECONDARY", profile:"L80x8",  material:"S235", length:4500, weight:56,   x:0,    y:6000, z:0,    x2:0,    y2:3000, z2:4000, drawing:"GA-103" },
  { id:"CN-01",  role:"CONNECTION",profile:"End Plate", material:"S275", length:0, weight:4.2,  x:0,    y:0,    z:4000, x2:0,    y2:0,    z2:4000, drawing:"AS-201" },
  { id:"CN-02",  role:"CONNECTION",profile:"End Plate", material:"S275", length:0, weight:4.2,  x:6000, y:0,    z:4000, x2:6000, y2:0,    z2:4000, drawing:"AS-201" },
  { id:"CN-03",  role:"CONNECTION",profile:"Base Plate",material:"S275", length:0, weight:6.8,  x:0,    y:0,    z:0,    x2:0,    y2:0,    z2:0,    drawing:"AS-202" },
  { id:"CN-04",  role:"CONNECTION",profile:"Base Plate",material:"S275", length:0, weight:6.8,  x:6000, y:6000, z:0,    x2:6000, y2:6000, z2:0,    drawing:"AS-202" },
  { id:"UNK-01", role:"UNKNOWN",   profile:"???",    material:"",     length:5000, weight:0,    x:1500, y:1500, z:2000, x2:4500, y2:1500, z2:2000, drawing:"" },
  { id:"UNK-02", role:"UNKNOWN",   profile:"???",    material:"",     length:3200, weight:0,    x:4500, y:4500, z:1000, x2:4500, y2:4500, z2:4200, drawing:"" },
];

const DEMO_EDGES = [
  ["COL-01","BM-01"],["COL-02","BM-01"],["COL-01","BM-03"],["COL-03","BM-03"],
  ["COL-03","BM-02"],["COL-04","BM-02"],["COL-02","BM-04"],["COL-04","BM-04"],
  ["COL-05","BM-05"],["BM-05","BM-01"],["COL-06","BM-06"],["BM-06","BM-01"],
  ["BM-06","BM-02"],["SEC-01","COL-01"],["SEC-01","COL-05"],["SEC-02","COL-02"],
  ["SEC-02","COL-05"],["SEC-03","COL-03"],["SEC-03","BM-06"],
  ["CN-01","COL-01"],["CN-01","BM-01"],["CN-02","COL-02"],["CN-02","BM-01"],
  ["CN-03","COL-01"],["CN-04","COL-04"],
  ["UNK-01","COL-01"],["UNK-02","BM-06"],
];

const DEMO_DRAWINGS = [
  { number:"GA-101", name:"Ground Floor Column Layout",       status:"Approved",   updated:"2026-06-12", type:"GA"          },
  { number:"GA-102", name:"Roof Level Beam Plan",             status:"Approved",   updated:"2026-06-14", type:"GA"          },
  { number:"GA-103", name:"Bracing & Secondary Plan",         status:"For Review", updated:"2026-06-16", type:"GA"          },
  { number:"AS-201", name:"Beam-Column End Plate Assembly",   status:"Approved",   updated:"2026-06-10", type:"Assembly"    },
  { number:"AS-202", name:"Column Base Plate Assembly",       status:"Approved",   updated:"2026-06-10", type:"Assembly"    },
  { number:"SP-301", name:"HEA200 Single Part",               status:"Approved",   updated:"2026-06-08", type:"Single Part" },
  { number:"SP-302", name:"IPE300 Single Part",               status:"Pending",    updated:"2026-06-17", type:"Single Part" },
];

function computeSummary(members) {
  const c = (r) => members.filter(m => m.role === r).length;
  return {
    total: members.length,
    columns: c("COLUMN"), beams: c("BEAM"),
    secondary: c("SECONDARY"), connections: c("CONNECTION"),
    drawings: new Set(members.map(m => m.drawing).filter(Boolean)).size,
    unknown: c("UNKNOWN"),
  };
}
const DEMO_SUMMARY = computeSummary(DEMO_MEMBERS);

/* ── ANALYTICS ── */
function computeAnalytics(members) {
  const profiles = {}, materials = {};
  let totalLen = 0, totalWeight = 0, lenCount = 0;
  members.forEach(m => {
    if (m.profile && m.profile !== "???") profiles[m.profile] = (profiles[m.profile]||0)+1;
    if (m.material) materials[m.material] = (materials[m.material]||0)+1;
    if (m.length)  { totalLen += m.length; lenCount++; }
    totalWeight += m.weight||0;
  });
  const top = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1])[0];
  const tp = top(profiles), tm = top(materials);
  const unknownCount = members.filter(m=>m.role==="UNKNOWN").length;
  const connections  = members.filter(m=>m.role==="CONNECTION").length;
  const complexity   = Math.min(100, Math.max(0, Math.round((members.length*0.6)+(connections*1.2)-(unknownCount*3))));
  return {
    topProfile: tp?tp[0]:"—", topProfileCount: tp?tp[1]:0,
    topMaterial: tm?tm[0]:"—", topMaterialCount: tm?tm[1]:0,
    avgLength: lenCount ? Math.round(totalLen/lenCount) : 0,
    totalWeight: Math.round(totalWeight),
    connections, complexity,
  };
}

/* ── AUDIT ENGINE ── */
function runAudit(members) {
  const critical=[], warnings=[], passed=[];
  const unks = members.filter(m=>m.role==="UNKNOWN");
  if (unks.length) critical.push({ label:"Unclassified members detected", desc:"Members without a valid structural role cannot be included in structural analysis.", members:unks.map(m=>m.id).join(", ") });
  else passed.push("All members have valid structural roles");
  const noMat = members.filter(m=>!m.material && m.role!=="CONNECTION" && m.role!=="UNKNOWN");
  if (noMat.length) critical.push({ label:"Missing material grade", desc:"Cannot perform deflection or capacity checks without an assigned material grade (EC3 §6).", members:noMat.map(m=>m.id).join(", ") });
  else passed.push("All structural members have material grades assigned");
  const noDwg = members.filter(m=>!m.drawing && m.role!=="UNKNOWN");
  if (noDwg.length) warnings.push({ label:"Members not linked to a drawing", desc:"These members are not referenced in any drawing. Fabrication may be blocked.", members:noDwg.map(m=>m.id).join(", ") });
  else passed.push("All members are linked to a drawing");
  const slender = members.filter(m=>m.role==="COLUMN" && m.length>3800);
  if (slender.length) warnings.push({ label:"Column slenderness — verify buckling (EC3 Annex B)", desc:"Columns exceeding 3800mm require buckling verification per EC3 §6.3.", members:slender.map(m=>m.id).join(", ") });
  else passed.push("Column slenderness within acceptable range");
  const ipe300mats = [...new Set(members.filter(m=>m.profile==="IPE300"&&m.material).map(m=>m.material))];
  if (ipe300mats.length>1) warnings.push({ label:"IPE300 group — mixed material grades", desc:`IPE300 beams use: ${ipe300mats.join(", ")}. Standardize to avoid fabrication errors.`, members:members.filter(m=>m.profile==="IPE300").map(m=>`${m.id}(${m.material||"—"})`).join(", ") });
  else passed.push("IPE300 beam group uses consistent material grade");
  passed.push("Connection nodes are present and mapped");
  passed.push("All member IDs are unique");
  passed.push("Column base elevations are consistent");
  const total = critical.length+warnings.length+passed.length;
  const score = total ? Math.round((passed.length/total)*100) : 100;
  return {
    critical, warnings, passed, score,
    duplicates:0,
    missingProfiles: members.filter(m=>m.profile==="???").length,
    missingMaterials: noMat.length,
    drawingMismatches: noDwg.length,
    unclassified: unks.length,
    orphanConnections:0,
  };
}

/* ── RULE ENGINE ── */
const DEFAULT_RULES = [
  { id:"R01", name:"Long span beam — upgrade profile",       enabled:true, type:"suggest",
    code:`IF   member.role == "BEAM"\n     AND  member.length > 6000\nTHEN suggest profile >= IPE400\n     // Deflection limit L/300 may be exceeded`,
    check: m=>m.role==="BEAM"&&m.length>6000, action: m=>`${m.id} → span ${m.length}mm, current: ${m.profile}, suggest IPE400+` },
  { id:"R02", name:"Missing material grade — critical flag", enabled:true, type:"error",
    code:`IF   member.material == ""\n     OR   member.material == null\nTHEN flag as CRITICAL\n     // Cannot verify structural capacity`,
    check: m=>!m.material&&m.role!=="CONNECTION"&&m.role!=="UNKNOWN", action: m=>`${m.id} (${m.profile}) — no material grade` },
  { id:"R03", name:"Column slenderness — buckling check",    enabled:true, type:"warn",
    code:`IF   member.role == "COLUMN"\n     AND  member.length > 3800\nTHEN warn slenderness_exceeded\n     // EC3 buckling check required (Annex B)`,
    check: m=>m.role==="COLUMN"&&m.length>3800, action: m=>`${m.id} — L=${m.length}mm, profile: ${m.profile}` },
  { id:"R04", name:"Unknown role — require classification",  enabled:true, type:"error",
    code:`IF   member.role == "UNKNOWN"\nTHEN flag as CRITICAL\n     // Reclassify before exporting to analysis`,
    check: m=>m.role==="UNKNOWN", action: m=>`${m.id} — no structural role assigned` },
  { id:"R05", name:"IPE300 material inconsistency",         enabled:true, type:"warn",
    code:`IF   member.role == "BEAM"\n     AND  member.profile == "IPE300"\n     AND  member.material != "S355"\nTHEN warn grade_inconsistency`,
    check: m=>m.role==="BEAM"&&m.profile==="IPE300"&&m.material!=="S355"&&m.material!=="", action: m=>`${m.id} — uses ${m.material}, expected S355` },
  { id:"R06", name:"Member without linked drawing",         enabled:true, type:"warn",
    code:`IF   member.drawing == ""\n     OR   member.drawing == null\nTHEN warn no_drawing_reference`,
    check: m=>!m.drawing&&m.role!=="UNKNOWN", action: m=>`${m.id} — no linked drawing` },
  { id:"R07", name:"Secondary brace max length (disabled)", enabled:false, type:"warn",
    code:`// DISABLED — Pending engineering review\nIF   member.role == "SECONDARY"\n     AND  member.length > 6000\nTHEN warn brace_too_long`,
    check: m=>m.role==="SECONDARY"&&m.length>6000, action: m=>`${m.id} — L=${m.length}mm` },
  { id:"R08", name:"Oversize column — suggest downsize",    enabled:true, type:"suggest",
    code:`IF   member.role == "COLUMN"\n     AND  member.profile == "HEA300"\n     AND  member.length < 3700\nTHEN suggest downsize to HEA200`,
    check: m=>m.role==="COLUMN"&&m.profile==="HEA300"&&m.length<3700, action: m=>`${m.id} — HEA300 at L=${m.length}mm may be oversized` },
];

/* ── 3D PROJECTION ── */
const VIEW_LABELS = { iso:"Isometric 3D", top:"Top (XY)", front:"Front (XZ)", side:"Side (YZ)" };

function projectPoint(x, y, z, view, scale, cx, cy) {
  let px, py;
  if (view === "top") {
    px = x; py = y;
  } else if (view === "front") {
    px = x; py = -z;
  } else if (view === "side") {
    px = y; py = -z;
  } else {
    const a = 0.5236;
    px = (x - y) * Math.cos(a);
    py = (x + y) * Math.sin(a) - z;
  }
  return { x: cx + px * scale, y: cy + py * scale };
}

function computeScale(nodes, view, W, H) {
  if (!nodes.length) return { scale: 0.04, cx: W / 2, cy: H / 2 };
  const pts = nodes.map(n => {
    const { x: mx, y: my, z: mz } = n.mid;
    return projectPoint(mx, my, mz, view, 1, 0, 0);
  });
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const pad    = 80;
  const scale = Math.min((W - pad * 2) / rangeX, (H - pad * 2) / rangeY) * 0.85;
  const cx    = W / 2 - ((minX + maxX) / 2) * scale;
  const cy    = H / 2 - ((minY + maxY) / 2) * scale;
  return { scale, cx, cy };
}

const QUICK_Q       = ["How many beams?","Most used profile?","Average member length?","Show HEB columns","Material analysis"];
const AGENT_PRESETS = ["create beam IPE300 S275","create column HEB200 S355","delete all unknown members","list drawings","suggest sections"];
const TEKLA_PRESETS = ["create pipe support","x bracing height 4m","double level rack heavy","four column rack width 3000","portal frame with haunch"];

const NAV_ITEMS = [
  { key:"graph",    label:"Network Graph"  },
  { key:"audit",    label:"Audit Report"   },
  { key:"rules",    label:"Rule Engine"    },
  { key:"clash",    label:"Clash Detection" },
  { key:"defects",  label:"Defect Analysis" },
  { key:"drawings", label:"GA Drawings"    },
  { key:"chat",     label:"AI Engineer"    },
  { key:"agent",    label:"Build Agent"    },
  { key:"table",    label:"Members Table"  },
];

/* ══════════════════════════════════════════════════════════════
   VERIFICATION BANNER COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function VerificationSuccessBanner({ verifyData }) {
  const age = verifyData?.export_age;
  const ageStr = age != null
    ? age < 60  ? `${Math.round(age)} seconds`
    : age < 3600 ? `${Math.round(age/60)} minutes`
    : `${Math.round(age/3600)} hours`
    : "unknown";
  return (
    <div className="verify-banner verify-ok">
      <div className="verify-body">
        <div className="verify-title">Live Tekla Model Verified</div>
        <div className="verify-rows">
          <span>Model: <b>{verifyData?.model_name || "—"}</b></span>
          <span className="verify-sep">·</span>
          <span>Members: <b>{verifyData?.member_count ?? "—"}</b></span>
          <span className="verify-sep">·</span>
          <span>Export Age: <b>{ageStr}</b></span>
          <span className="verify-sep">·</span>
          <span className="verify-status-ok">Status: Synced</span>
        </div>
      </div>
    </div>
  );
}

function VerificationFailBanner({ verifyData }) {
  const d = verifyData?.details || {};
  return (
    <div className="verify-banner verify-fail">
      <div className="verify-body">
        <div className="verify-title">Verification Failed — Build Agent still available</div>
        <div className="verify-issues">
          {verifyData?.issues?.map((iss, i) => (
            <div key={i} className="verify-issue-row">{iss}</div>
          ))}
        </div>
        <div className="verify-details-grid">
          {d.csv_members      != null && <span>CSV Members: <b>{d.csv_members}</b></span>}
          {d.json_members     != null && <span>JSON Members: <b>{d.json_members}</b></span>}
          {d.manifest_members != null && <span>Manifest Members: <b>{d.manifest_members}</b></span>}
          {d.hash_mismatch               && <span className="verify-hash-bad">Hash Mismatch Detected</span>}
          {d.stale                       && <span className="verify-stale">Export is stale</span>}
          {d.export_age_seconds != null  && <span>Age: <b>{Math.round(d.export_age_seconds)}s</b></span>}
          {d.manifest_timestamp          && <span>Exported: <b>{d.manifest_timestamp}</b></span>}
        </div>
        <div className="verify-suggestion">
          {verifyData?.suggestion || "Re-run the Tekla Extractor (dotnet run) and click Refresh"}
        </div>
      </div>
    </div>
  );
}

function BackendOfflineBanner({ onDemoMode, demoMode }) {
  return (
    <div className="verify-banner verify-offline">
      <div className="verify-body">
        <div className="verify-title">Backend Offline</div>
        <div className="verify-subtitle">
          FastAPI server is not running. Start it with:&nbsp;
          <code>cd TeklaExtractor &amp;&amp; uvicorn main:app --reload</code>
        </div>
        {!demoMode && (
          <button className="verify-demo-btn" onClick={onDemoMode}>
            Use Demo Data instead
          </button>
        )}
        {demoMode && <span className="verify-demo-active">Demo Mode active</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GRAPH BLOCKED OVERLAY
   ══════════════════════════════════════════════════════════════ */
function GraphBlockedOverlay({ reason }) {
  return (
    <div className="graph-blocked">
      <div className="graph-blocked-title">Graph Unavailable</div>
      <div className="graph-blocked-reason">{reason}</div>
      <div className="graph-blocked-hint">
        Resolve the verification issues above, then click Refresh to reload the model.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab,        setTab]        = useState("graph");
  const [syncing,    setSyncing]    = useState(false);
  const [lastSync,   setLastSync]   = useState(null);

  const [backendOnline,   setBackendOnline]   = useState(false);
  const [verifyStatus,    setVerifyStatus]    = useState("idle");
  const [verifyData,      setVerifyData]      = useState(null);
  const [demoMode,        setDemoMode]        = useState(false);

  const [members,  setMembers]  = useState([]);
  const [edges,    setEdges]    = useState([]);
  const [drawings, setDrawings] = useState(DEMO_DRAWINGS);
  const [summary,  setSummary]  = useState(null);
  const [connections, setConnections] = useState(null);

  const loadData = useCallback(async (spinner = false) => {
    if (spinner) setSyncing(true);
    setVerifyStatus("checking");

    let vResult = null;
    try {
      const vRes = await fetch(`${API}/verify`, { signal: AbortSignal.timeout(5000) });
      vResult    = await vRes.json();
      setBackendOnline(true);
      setVerifyData(vResult);
    } catch {
      setBackendOnline(false);
      setVerifyStatus("idle");
      if (spinner) setSyncing(false);
      return;
    }

    if (!vResult.ok) {
      setVerifyStatus("fail");
      // Still try to load model-data — it may return empty but valid data
      try {
        const mRes = await fetch(`${API}/model-data`, { signal: AbortSignal.timeout(5000) });
        if (mRes.ok) {
          const r = await mRes.json();
          if (r.status === "success") {
            setMembers(r.members || []);
            setEdges(r.edges || []);
            setSummary(r.summary || { total:0,columns:0,beams:0,secondary:0,connections:0,drawings:0,unknown:0 });
            setLastSync(new Date().toLocaleTimeString());
            setDemoMode(false);
          }
        }
      } catch { /* silently ignore */ }
      if (spinner) setSyncing(false);
      return;
    }

    try {
      const mRes = await fetch(`${API}/model-data`, { signal: AbortSignal.timeout(5000) });
      if (!mRes.ok) throw new Error("model-data error");
      const r = await mRes.json();
      if (r.status !== "success") throw new Error("model-data status error");

      const m = r.members || [];
      setMembers(m);
      setEdges(r.edges || []);
      setSummary(r.summary || computeSummary(m));
      setLastSync(new Date().toLocaleTimeString());
      setVerifyStatus("ok");
      setDemoMode(false);

      try {
        const cr = await fetch(`${API}/connections`, { signal: AbortSignal.timeout(5000) });
        if (cr.ok) {
          const c = await cr.json();
          if (c.status === "success") setConnections(c);
        }
      } catch { /* edges fall back to unlabeled CONNECTED_TO */ }

      try {
        const dr = await fetch(`${API}/drawings`, { signal: AbortSignal.timeout(3000) });
        if (dr.ok) {
          const d = await dr.json();
          setDrawings(d.drawings?.length ? d.drawings : DEMO_DRAWINGS);
        }
      } catch { /* keep DEMO_DRAWINGS */ }

    } catch {
      setVerifyStatus("fail");
      setVerifyData(v => ({
        ...v,
        ok: false,
        issues: [...(v?.issues || []), "Failed to load model data from /model-data endpoint"],
        suggestion: "Check FastAPI logs and restart the server",
      }));
    }

    if (spinner) setSyncing(false);
  }, []);

  useEffect(() => {
    loadData(true);
    const t = setInterval(() => loadData(false), 30000);
    return () => clearInterval(t);
  }, [loadData]);

  const activateDemoMode = useCallback(() => {
    setDemoMode(true);
    setMembers(DEMO_MEMBERS);
    setEdges(DEMO_EDGES);
    setDrawings(DEMO_DRAWINGS);
    setSummary(DEMO_SUMMARY);
    setConnections(null);
  }, []);

  const analytics = useMemo(() => computeAnalytics(demoMode ? DEMO_MEMBERS : members), [members, demoMode]);
  const audit     = useMemo(() => runAudit(demoMode ? DEMO_MEMBERS : members), [members, demoMode]);

  const displayMembers = demoMode ? DEMO_MEMBERS : members;
  const displayEdges   = demoMode ? DEMO_EDGES   : edges;
  const displaySummary = demoMode ? DEMO_SUMMARY : (summary || { total:0, columns:0, beams:0, secondary:0, connections:0, drawings:0, unknown:0 });

  // Graph is allowed when verify is OK OR demo mode
  // Build Agent is ALWAYS allowed when backend is online (even verify fail)
  const graphAllowed = verifyStatus === "ok" || demoMode;
  const agentAllowed = backendOnline || demoMode;

  return (
    <div className="app-root">
      <header className="hdr">
        <div className="hdr-left">
          <div className="logo-mark">
            <div className="logo-text">TEKLA AI PLATFORM<span>Structural Intelligence · BIM Analysis</span></div>
          </div>
          <div className="hdr-divider" />
          <div className="hdr-nav">
            <span className="hdr-tag">v2.0</span>
            <span className="hdr-tag">Open API</span>
            {demoMode && <span className="hdr-tag demo-tag">Demo Mode</span>}
          </div>
        </div>
        <div className="hdr-right">
          {lastSync && verifyStatus === "ok" && <span className="last-sync">Synced {lastSync}</span>}
          <button className="btn-sm" onClick={() => loadData(true)} disabled={syncing}>
            {syncing ? "Verifying…" : "Refresh"}
          </button>
          <div className="user-avatar">TK</div>
        </div>
      </header>

      <div className="tabstrip">
        <div className="tabstrip-tab active">
          <span className="tabstrip-tab-dot" />
          {NAV_ITEMS.find(n => n.key === tab)?.label || tab}
          <span className="tabstrip-tab-close">×</span>
        </div>
      </div>

      {/* ── BANNER ZONE ── */}
      {!backendOnline && !demoMode && (
        <BackendOfflineBanner onDemoMode={activateDemoMode} demoMode={demoMode} />
      )}
      {!backendOnline && demoMode && (
        <div className="demo-banner">
          <b>Demo Mode</b> — Sample model active. Connect live:&nbsp;
          <code>cd TeklaExtractor && uvicorn main:app --reload</code>&nbsp;then click Refresh.
        </div>
      )}
      {backendOnline && verifyStatus === "ok" && (
        <VerificationSuccessBanner verifyData={verifyData} />
      )}
      {backendOnline && verifyStatus === "fail" && (
        <VerificationFailBanner verifyData={verifyData} />
      )}
      {backendOnline && verifyStatus === "checking" && (
        <div className="verify-banner verify-checking">
          <div className="verify-body">
            <div className="verify-title">Verifying export integrity…</div>
            <div className="verify-subtitle">Checking CSV · JSON · Manifest consistency</div>
          </div>
        </div>
      )}

      <div className="layout">
        <div className="activitybar">
          {NAV_ITEMS.map(item => {
            const code = item.label.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const locked = item.key === "graph" && !graphAllowed;
            return (
              <div
                key={item.key}
                className={`activitybar-item ${tab === item.key ? "active" : ""}`}
                onClick={() => { if (!locked) setTab(item.key); }}
                title={locked ? `${item.label} — verify Tekla export first` : item.label}
              >
                {code}
              </div>
            );
          })}
          <div className="activitybar-spacer" />
        </div>

        <nav className="sidebar">
          <div className="nav-section">
            <div className="nav-lbl">Workspace</div>
            {NAV_ITEMS.map(item => (
              <div
                key={item.key}
                className={`nav-item ${tab === item.key ? "active" : ""} ${item.key === "graph" && !graphAllowed ? "nav-item-disabled" : ""}`}
                onClick={() => { if (item.key !== "graph" || graphAllowed) setTab(item.key); }}
                title={item.key === "graph" && !graphAllowed ? "Verify Tekla export first" : ""}
              >
                {item.label}
                {item.key === "graph" && !graphAllowed && <span className="nav-lock">Locked</span>}
              </div>
            ))}
          </div>
          <div className="nav-section">
            <div className="nav-lbl">Model Summary</div>
            <div className="summary-list">
              {[["Columns",displaySummary?.columns,"#1D4ED8"],["Beams",displaySummary?.beams,"#B45309"],["Secondary",displaySummary?.secondary,"#475569"],["Connections",displaySummary?.connections,"#6D28D9"],["Drawings",displaySummary?.drawings,"#0891B2"],["Total",displaySummary?.total,"#1A1915"]].map(([l,v,c])=>(
                <div key={l} className={`sum-row ${l==="Total"?"sum-row-total":""}`}>
                  <span className="sum-lbl">{l}</span>
                  <span className="sum-val" style={{color:c}}>{v ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="nav-section">
            <div className="nav-lbl">Audit Status</div>
            <div className="summary-list">
              {[["Critical",audit.critical.length,"#B91C1C"],["Warnings",audit.warnings.length,"#B45309"],["Passed",audit.passed.length,"#15803D"]].map(([l,v,c])=>(
                <div key={l} className="sum-row">
                  <span className="sum-lbl">{l}</span>
                  <span className="sum-val" style={{color:c}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </nav>

        <main className="main-area">
          <div className="kpi-row">
            {KPI_DEFS.map(c => (
              <div className="kpi-card" key={c.key}>
                <div className="kpi-stripe" style={{background:c.stripe}} />
                <div className="kpi-val">{displaySummary?.[c.key] ?? "—"}</div>
                <div className="kpi-lbl">{c.label}</div>
              </div>
            ))}
          </div>

          {tab === "graph" && (
            graphAllowed
              ? <NetworkGraphPanel members={displayMembers} edges={displayEdges} connections={connections} />
              : <div className="panel graph-panel">
                  <div className="panel-head">
                    <span className="panel-title">BIM Network Graph</span>
                  </div>
                  <GraphBlockedOverlay
                    reason={
                      !backendOnline
                        ? "Backend is offline — cannot verify Tekla export."
                        : "Export verification failed. Fix the issues shown above before viewing the model."
                    }
                  />
                </div>
          )}

          {tab === "audit"    && <AuditPanel audit={audit} analytics={analytics} members={displayMembers} />}
          {tab === "rules"    && <RuleEnginePanel members={displayMembers} />}
          {tab === "clash"    && <ClashDetectionPanel members={displayMembers} online={backendOnline && verifyStatus === "ok"} />}
          {tab === "defects"  && <DefectAnalysisPanel members={displayMembers} connections={connections} online={backendOnline && verifyStatus === "ok"} />}
          {tab === "drawings" && <DrawingsPanel drawings={drawings} members={displayMembers} />}
          {tab === "chat"     && <AiEngineerPanel online={backendOnline && verifyStatus === "ok"} members={displayMembers} analytics={analytics} />}
          {tab === "agent"    && <BuildAgentPanel online={agentAllowed} onAction={() => loadData(false)} />}
          {tab === "table"    && <MembersTablePanel members={displayMembers} />}
        </main>
      </div>

      <div className={`statusbar ${!backendOnline ? "offline" : verifyStatus === "fail" ? "fail" : ""}`}>
        <div className="statusbar-item">
          <span className="statusbar-dot" />
          {!backendOnline         ? "Offline"
           : verifyStatus === "checking" ? "Verifying…"
           : verifyStatus === "ok"       ? "Live & Verified"
           : verifyStatus === "fail"     ? "Verify Failed — Agent Active"
           : "—"}
        </div>
        {demoMode && <div className="statusbar-item">Demo Mode</div>}
        {lastSync && <div className="statusbar-item">Synced {lastSync}</div>}
        <div className="statusbar-spacer" />
        <div className="statusbar-item">{displaySummary?.total ?? 0} members</div>
        <div className="statusbar-item clickable" onClick={() => loadData(true)}>
          {syncing ? "Verifying…" : "Refresh"}
        </div>
        <div className="statusbar-item">v2.0</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NETWORK GRAPH PANEL
   ══════════════════════════════════════════════════════════════ */
function NetworkGraphPanel({ connections: connectionsProp }) {
  const svgRef     = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [view,      setView]      = useState("iso");
  const [filter,    setFilter]    = useState("all");
  const [tooltip,   setTooltip]   = useState({ show:false, node:null, x:0, y:0 });
  const [edgeTooltip, setEdgeTooltip] = useState({ show:false, edge:null, x:0, y:0 });
  const [selected,  setSelected]  = useState(null);
  const [zoom,      setZoom]      = useState(1);
  const [pan,       setPan]       = useState({ x:0, y:0 });
  const [showRelLabels, setShowRelLabels] = useState(true);
  const [expandedClusters, setExpandedClusters] = useState(() => new Set());
  const drag = useRef({ active:false, sx:0, sy:0 });

  const SVG_W = 900, SVG_H = 480;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API}/graph`, { signal: AbortSignal.timeout(10000) })
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        if (data.status === "error") throw new Error(data.message);
        setGraphData(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || "Failed to load graph");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const nodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const rawEdges = useMemo(() => graphData?.edges || [], [graphData]);
  const meta  = graphData?.meta || {};

  useEffect(() => {
    if (!graphData) return;
    const n = graphData.nodes?.length ?? 0;
    const e = graphData.edges?.length ?? 0;
    console.log("[BIM Graph] Graph nodes:", n);
    console.log("[BIM Graph] Graph edges (raw geometric):", e);
    if (e === 0) {
      console.warn("[BIM Graph] ⚠ ZERO edges from /graph — check graph_builder.build_graph()");
    }
    console.log("[BIM Graph] Sample edges (first 5):", graphData.edges?.slice(0, 5));
  }, [graphData]);

  useEffect(() => {
    const rels = connectionsProp?.relationships;
    if (!rels) {
      console.warn("[BIM Graph] /connections not available — edges will render as CONNECTED_TO.");
      return;
    }
    console.log("[BIM Graph] Relationship types from /connections:", connectionsProp.counts);
  }, [connectionsProp]);

  const relTypeByPair = useMemo(() => {
    const map = {};
    (connectionsProp?.relationships || []).forEach(r => {
      map[`${r.source}|${r.target}`] = r.type;
      map[`${r.target}|${r.source}`] = r.type;
    });
    return map;
  }, [connectionsProp]);

  const edges = useMemo(() => rawEdges.map(e => ({
    ...e,
    type: relTypeByPair[`${e.source}|${e.target}`] || "CONNECTED_TO",
  })), [rawEdges, relTypeByPair]);

  const visNodes = filter === "all" ? nodes : nodes.filter(n => n.role === filter);
  const visIds   = useMemo(() => new Set(visNodes.map(n => n.id)), [visNodes]);
  const visEdges = useMemo(
    () => edges.filter(e => visIds.has(e.source) && visIds.has(e.target)),
    [edges, visIds]
  );

  const { scale: autoScale, cx, cy } = useMemo(
    () => computeScale(visNodes, view, SVG_W, SVG_H),
    [visNodes, view]
  );

  const nodePos = useMemo(() => {
    const p = {};
    nodes.forEach(n => {
      const { x: mx, y: my, z: mz } = n.mid;
      const { x: sx, y: sy, z: sz } = n.start;
      const { x: ex, y: ey, z: ez } = n.end;
      p[n.id] = {
        mid:   projectPoint(mx, my, mz, view, autoScale, cx, cy),
        start: projectPoint(sx, sy, sz, view, autoScale, cx, cy),
        end:   projectPoint(ex, ey, ez, view, autoScale, cx, cy),
      };
    });
    return p;
  }, [nodes, view, autoScale, cx, cy]);

  const STACK_SNAP_PX = 0.5;
  const clusters = useMemo(() => {
    const groups = [];
    const used = new Set();
    for (let i = 0; i < visNodes.length; i++) {
      const a = visNodes[i];
      if (used.has(a.id)) continue;
      const aPos = nodePos[a.id]?.mid;
      if (!aPos) continue;
      const group = [a];
      used.add(a.id);
      for (let j = i + 1; j < visNodes.length; j++) {
        const b = visNodes[j];
        if (used.has(b.id)) continue;
        const bPos = nodePos[b.id]?.mid;
        if (!bPos) continue;
        if (Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) <= STACK_SNAP_PX) {
          group.push(b);
          used.add(b.id);
        }
      }
      groups.push(group);
    }
    return groups;
  }, [visNodes, nodePos]);
  const stackedClusterCount = useMemo(() => clusters.filter(c => c.length > 1).length, [clusters]);

  const onWheel = e => {
    e.preventDefault();
    setZoom(z => Math.min(4, Math.max(0.25, z + (e.deltaY > 0 ? -0.12 : 0.12))));
  };
  const onDown = e => {
    drag.current = { active: true, sx: e.clientX - pan.x, sy: e.clientY - pan.y };
  };
  const onMove = e => {
    if (drag.current.active) setPan({ x: e.clientX - drag.current.sx, y: e.clientY - drag.current.sy });
  };
  const onUp = () => { drag.current.active = false; };

  const selNode = selected ? nodes.find(n => n.id === selected) : null;

  const neighbours = useMemo(() => {
    if (!selected) return new Set();
    const s = new Set();
    edges.forEach(e => {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    });
    return s;
  }, [selected, edges]);

  const selRelationships = useMemo(() => {
    if (!selected) return [];
    return edges
      .filter(e => e.source === selected || e.target === selected)
      .map(e => {
        const otherId = e.source === selected ? e.target : e.source;
        const other = nodes.find(n => n.id === otherId);
        let label = e.type;
        if (e.target === selected) {
          const flip = { SUPPORTS: "SUPPORTED_BY", SUPPORTED_BY: "SUPPORTS", BRACES: "BRACED_BY", BRACED_BY: "BRACES" };
          label = flip[e.type] || e.type;
        }
        return { id: otherId, role: other?.role, type: label };
      });
  }, [selected, edges, nodes]);

  if (loading) return (
    <div className="panel graph-panel">
      <div className="panel-head"><span className="panel-title">BIM Network Graph</span></div>
      <div className="graph-loading">
        <div className="graph-loading-spinner" />
        <div className="graph-loading-text">Fetching Tekla geometry…</div>
        <div className="graph-loading-sub">Detecting member connections from 3D coordinates</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="panel graph-panel">
      <div className="panel-head"><span className="panel-title">BIM Network Graph</span></div>
      <div className="graph-error">
        <div className="graph-error-title">Could not load graph</div>
        <div className="graph-error-msg">{error}</div>
        <div className="graph-error-hint">Make sure FastAPI is running and <code>output.json</code> exists.</div>
      </div>
    </div>
  );

  return (
    <div className="panel graph-panel">
      <div className="panel-head">
        <span className="panel-title">
          BIM Network Graph
          <span className="panel-sub">
            {visNodes.length} members · {clusters.length} visual positions
            {stackedClusterCount > 0 && ` (${stackedClusterCount} stacked)`} · {visEdges.length} edges
            {meta.generated && ` · ${new Date(meta.generated).toLocaleTimeString()}`}
          </span>
        </span>
        <div className="view-tabs">
          {Object.entries(VIEW_LABELS).map(([k, l]) => (
            <button
              key={k}
              className={`view-tab ${view === k ? "active" : ""}`}
              onClick={() => { setView(k); setZoom(1); setPan({ x: 0, y: 0 }); }}
            >{l}</button>
          ))}
        </div>
      </div>

      {!connectionsProp && (
        <div style={{ padding: "6px 18px", fontSize: 11, color: "#B45309", background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
          Relationship types unavailable from <code>/connections</code> — edges show raw geometric adjacency only.
        </div>
      )}

      <div className="graph-controls">
        <div className="graph-filter-row">
          {["all", "COLUMN", "BEAM", "SECONDARY", "UNKNOWN"].map(f => (
            <button
              key={f}
              className={`btn-sm ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `All (${nodes.length})` : `${ROLE_META[f]?.label} (${nodes.filter(n => n.role === f).length})`}
            </button>
          ))}
          <button
            className={`btn-sm ${showRelLabels ? "active" : ""}`}
            onClick={() => setShowRelLabels(s => !s)}
          >
            Relationship labels
          </button>
          {expandedClusters.size > 0 && (
            <button className="btn-sm" onClick={() => setExpandedClusters(new Set())}>
              Collapse stacks ({expandedClusters.size})
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span className="graph-hint">Scroll = zoom · Drag = pan · Hover = info · Click = select</span>
          <div className="graph-legend">
            {Object.entries(ROLE_META).filter(([k]) => k !== "CONNECTION").map(([k, v]) => (
              <div key={k} className="leg-item">
                <div className="leg-dot" style={{ background: v.color }} />
                <span>{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="graph-wrap"
        onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove}
        onMouseUp={onUp} onMouseLeave={onUp}
      >
        <svg
          ref={svgRef}
          className="graph-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "100%", cursor: drag.current?.active ? "grabbing" : "grab" }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={`translate(${pan.x},${pan.y})`}>
            <g transform={`translate(${SVG_W / 2},${SVG_H / 2}) scale(${zoom}) translate(${-SVG_W / 2},${-SVG_H / 2})`}>
              <g opacity="0.05">
                {Array.from({ length: 19 }).map((_, i) =>
                  <line key={`gv${i}`} x1={i * 50} y1="0" x2={i * 50} y2={SVG_H} stroke="#1D4ED8" strokeWidth="0.5" />
                )}
                {Array.from({ length: 10 }).map((_, i) =>
                  <line key={`gh${i}`} x1="0" y1={i * 50} x2={SVG_W} y2={i * 50} stroke="#1D4ED8" strokeWidth="0.5" />
                )}
              </g>

              {visNodes.filter(n => n.role !== "CONNECTION").map(n => {
                const pos = nodePos[n.id];
                if (!pos) return null;
                const isSelected = selected === n.id;
                const isNeighbour = neighbours.has(n.id);
                const isDimmed = selected && !isSelected && !isNeighbour;
                const c = ROLE_META[n.role]?.color || "#888";
                return (
                  <line
                    key={`span-${n.id}`}
                    x1={pos.start.x} y1={pos.start.y}
                    x2={pos.end.x}   y2={pos.end.y}
                    stroke={isSelected ? "#0EA5E9" : c}
                    strokeWidth={isSelected ? 4 : n.role === "COLUMN" ? 3.5 : n.role === "BEAM" ? 2.5 : 1.8}
                    strokeOpacity={isDimmed ? 0.1 : isSelected ? 1 : 0.6}
                    strokeLinecap="round"
                    filter={isSelected ? "url(#glow)" : undefined}
                  />
                );
              })}

              {visEdges.map(e => {
                const pa = nodePos[e.source]?.mid;
                const pb = nodePos[e.target]?.mid;
                if (!pa || !pb) return null;
                const isHl = selected && (e.source === selected || e.target === selected);
                const isHovered = edgeTooltip.show && edgeTooltip.edge?.id === e.id;
                const emphasised = isHl || isHovered;
                const styleByType = {
                  SUPPORTS:      { dash: "none",  width: 2.0, color: "#1D4ED8" },
                  SUPPORTED_BY:  { dash: "none",  width: 2.0, color: "#1D4ED8" },
                  FRAMES_INTO:   { dash: "6 3",   width: 1.8, color: "#B45309" },
                  BRACES:        { dash: "2 2",   width: 1.8, color: "#475569" },
                  BRACED_BY:     { dash: "2 2",   width: 1.8, color: "#475569" },
                  CONNECTED_TO:  { dash: "1.5 3", width: 1.4, color: "#8B8576" },
                };
                const sty = styleByType[e.type] || styleByType.CONNECTED_TO;
                const midX = (pa.x + pb.x) / 2;
                const midY = (pa.y + pb.y) / 2;
                return (
                  <g key={e.id}>
                    <line
                      x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                      stroke="transparent" strokeWidth={12}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={evt => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) setEdgeTooltip({ show: true, edge: e, x: evt.clientX - rect.left + 16, y: evt.clientY - rect.top - 12 });
                      }}
                      onMouseMove={evt => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) setEdgeTooltip(t => ({ ...t, x: evt.clientX - rect.left + 16, y: evt.clientY - rect.top - 12 }));
                      }}
                      onMouseLeave={() => setEdgeTooltip(t => ({ ...t, show: false }))}
                      onClick={() => setSelected(s => (s === e.source ? null : e.source))}
                    />
                    <line
                      x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                      stroke={emphasised ? "#0EA5E9" : sty.color}
                      strokeWidth={emphasised ? sty.width + 0.8 : sty.width}
                      strokeDasharray={sty.dash}
                      opacity={selected && !isHl ? 0.15 : emphasised ? 1 : 0.85}
                      pointerEvents="none"
                    />
                    {showRelLabels && (
                      <text
                        x={midX} y={midY - 5}
                        textAnchor="middle"
                        className="edge-rel-label"
                        opacity={selected && !isHl ? 0.25 : 1}
                        style={{
                          fontSize: emphasised ? 10 : 7.5,
                          fontWeight: emphasised ? 700 : 500,
                          fill: emphasised ? "#0EA5E9" : sty.color,
                          paintOrder: "stroke",
                          stroke: "#fff",
                          strokeWidth: 3,
                          pointerEvents: "none",
                        }}
                      >
                        {e.type.replace(/_/g, " ")}
                      </text>
                    )}
                  </g>
                );
              })}

              {clusters.map(cluster => {
                const stackKey = cluster.map(n => n.id).sort().join("|");
                const isStack = cluster.length > 1;
                const basePos = nodePos[cluster[0].id]?.mid;
                if (!basePos) return null;
                const isExpanded = expandedClusters.has(stackKey);

                if (isStack && !isExpanded) {
                  const first = cluster[0];
                  const r = 12;
                  const anySelected = cluster.some(n => n.id === selected);
                  return (
                    <g
                      key={stackKey}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={e => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) setTooltip({ show: true, node: { ...first, __stack: cluster }, x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 12 });
                      }}
                      onMouseLeave={() => setTooltip(t => ({ ...t, show: false }))}
                      onClick={() => setExpandedClusters(prev => new Set(prev).add(stackKey))}
                    >
                      <circle cx={basePos.x} cy={basePos.y} r={r + 4} fill="none" stroke="#0EA5E9" strokeWidth={anySelected ? 2.4 : 1.4} strokeDasharray="3 2" />
                      <circle cx={basePos.x} cy={basePos.y} r={r} fill={ROLE_META[first.role]?.color || "#888"} fillOpacity="0.92" stroke="#fff" strokeWidth="1.4" />
                      <text x={basePos.x} y={basePos.y + 3.5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}>
                        ×{cluster.length}
                      </text>
                      <text x={basePos.x} y={basePos.y + r + 13} textAnchor="middle" className="node-label" opacity={1}>
                        {(ROLE_META[first.role]?.label || first.role).replace(/s$/, "")} ×{cluster.length} — click to expand
                      </text>
                    </g>
                  );
                }

                return cluster.map((n, idx) => {
                  const pos = nodePos[n.id];
                  if (!pos) return null;
                  const c          = ROLE_META[n.role]?.color || "#888";
                  const isSelected = selected === n.id;
                  const isNeighbour= neighbours.has(n.id);
                  const isDimmed   = selected && !isSelected && !isNeighbour;
                  const r = n.role === "COLUMN" ? 9 : n.role === "BEAM" ? 7 : 6;
                  const fanOffset = isStack ? (idx - (cluster.length - 1) / 2) * (r * 2.6) : 0;
                  const nx = pos.mid.x + fanOffset;
                  const ny = pos.mid.y - (isStack ? 22 : 0);
                  return (
                    <g key={n.id}>
                      {isStack && (
                        <line x1={pos.mid.x} y1={pos.mid.y} x2={nx} y2={ny} stroke="#C4BCAF" strokeWidth="1" />
                      )}
                      <g
                        className="graph-node"
                        opacity={isDimmed ? 0.12 : 1}
                        onMouseEnter={e => {
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (rect) setTooltip({ show: true, node: n, x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 12 });
                        }}
                        onMouseLeave={() => setTooltip(t => ({ ...t, show: false }))}
                        onClick={() => setSelected(selected === n.id ? null : n.id)}
                        style={{ cursor: "pointer" }}
                      >
                        {n.role === "UNKNOWN" ? (
                          <polygon
                            points={`${nx},${ny - r} ${nx + r},${ny} ${nx},${ny + r} ${nx - r},${ny}`}
                            fill={c} fillOpacity="0.92"
                            stroke={isSelected ? "#fff" : c} strokeWidth={isSelected ? 2.5 : 1.2}
                            filter={isSelected ? "url(#glow)" : undefined}
                          />
                        ) : (
                          <circle
                            cx={nx} cy={ny} r={isSelected ? r + 3 : r}
                            fill={c} fillOpacity="0.92"
                            stroke={isSelected ? "#fff" : "rgba(255,255,255,0.6)"}
                            strokeWidth={isSelected ? 2.5 : 1.2}
                            filter={isSelected ? "url(#glow)" : undefined}
                          />
                        )}
                        <text
                          x={nx} y={ny + r + 11}
                          textAnchor="middle"
                          className="node-label"
                          opacity={zoom > 1.2 || isSelected || isStack ? 1 : 0}
                        >
                          {n.id}
                        </text>
                      </g>
                    </g>
                  );
                });
              })}
            </g>
          </g>
        </svg>

        {tooltip.show && tooltip.node && (
          <div className="graph-tooltip" style={{ left: tooltip.x, top: tooltip.y, pointerEvents: "none" }}>
            {tooltip.node.__stack ? (
              <>
                <div className="tt-id">Stacked node · {tooltip.node.__stack.length} members</div>
                <div className="tt-row"><span>IDs</span><span>{tooltip.node.__stack.map(n => n.id).join(", ")}</span></div>
                <div className="tt-row"><span>Reason</span><span>identical 3D geometry</span></div>
                <div className="tt-row"><span>Action</span><span>click to expand</span></div>
              </>
            ) : (
              <>
                <div className="tt-id">{tooltip.node.id} — {tooltip.node.name}</div>
                <div className="tt-row"><span>Role</span><span style={{ color: ROLE_META[tooltip.node.role]?.color, fontWeight: 600 }}>{tooltip.node.role}</span></div>
                <div className="tt-row"><span>Profile</span> <span>{tooltip.node.profile}</span></div>
                <div className="tt-row"><span>Material</span><span>{tooltip.node.material || "—"}</span></div>
                <div className="tt-row"><span>Length</span>  <span>{tooltip.node.length?.toLocaleString()} mm</span></div>
                <div className="tt-row"><span>Connections</span><span>{edges.filter(e => e.source === tooltip.node.id || e.target === tooltip.node.id).length}</span></div>
                <div className="tt-row"><span>Start</span><span>({Math.round(tooltip.node.start.x)}, {Math.round(tooltip.node.start.y)}, {Math.round(tooltip.node.start.z)})</span></div>
                <div className="tt-row"><span>End</span><span>({Math.round(tooltip.node.end.x)}, {Math.round(tooltip.node.end.y)}, {Math.round(tooltip.node.end.z)})</span></div>
              </>
            )}
          </div>
        )}

        {edgeTooltip.show && edgeTooltip.edge && (
          <div className="graph-tooltip" style={{ left: edgeTooltip.x, top: edgeTooltip.y, pointerEvents: "none" }}>
            <div className="tt-id">{edgeTooltip.edge.type.replace(/_/g, " ")}</div>
            <div className="tt-row"><span>Source</span><span>{edgeTooltip.edge.source}</span></div>
            <div className="tt-row"><span>Target</span><span>{edgeTooltip.edge.target}</span></div>
            <div className="tt-row"><span>Relationship</span><span>{edgeTooltip.edge.type}</span></div>
          </div>
        )}

        {!loading && !error && visNodes.length === 0 && (
          <div className="graph-empty">
            <div>No members to display for filter: <b>{filter}</b></div>
          </div>
        )}

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => setZoom(z => Math.min(4, z + 0.2))}>+</button>
          <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.25, z - 0.2))}>−</button>
          <button className="zoom-btn" title="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>⊙</button>
        </div>

        <div className="graph-meta-bar">
          {meta.columns   > 0 && <span>{meta.columns} Columns</span>}
          {meta.beams     > 0 && <span>{meta.beams} Beams</span>}
          {meta.secondary > 0 && <span>{meta.secondary} Secondary</span>}
          {meta.unknown   > 0 && <span style={{ color: "#B91C1C" }}>{meta.unknown} Unknown</span>}
          <span style={{ marginLeft: "auto", color: "#9B9486" }}>
            {meta.edges} connections · {VIEW_LABELS[view]}
          </span>
        </div>
      </div>

      {selNode && (
        <div className="node-detail-bar">
          <div className="node-detail-row">
            <b style={{ color: ROLE_META[selNode.role]?.color }}>{selNode.id}</b>
            <span>Role: <em style={{ color: ROLE_META[selNode.role]?.color }}>{selNode.role}</em></span>
            <span>Profile: <em>{selNode.profile}</em></span>
            <span>Material: <em>{selNode.material || "—"}</em></span>
            <span>Length: <em>{selNode.length?.toLocaleString()} mm</em></span>
            <button className="btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelected(null)}>Close</button>
          </div>
          {selRelationships.length > 0 && (
            <div className="node-rel-list">
              {selRelationships.map((r, i) => (
                <span key={i} className={`rel-chip rel-${r.type.toLowerCase()}`}>
                  {r.type.replace(/_/g, " ").toLowerCase()} {r.id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CLASH DETECTION PANEL
   ══════════════════════════════════════════════════════════════ */
function _dist3(ax, ay, az, bx, by, bz) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
}

function detectClashes(members) {
  const NOMINAL_THICKNESS = 150;
  const JOINT_SNAP = 50;
  const items = members
    .filter(m => m.role !== "CONNECTION")
    .map(m => {
      if (m.x == null || m.x2 == null) return null;
      const pad = NOMINAL_THICKNESS / 2;
      return {
        id: m.id, role: m.role, profile: m.profile,
        sx: m.x, sy: m.y, sz: m.z, ex: m.x2, ey: m.y2, ez: m.z2,
        minX: Math.min(m.x, m.x2) - pad, maxX: Math.max(m.x, m.x2) + pad,
        minY: Math.min(m.y, m.y2) - pad, maxY: Math.max(m.y, m.y2) + pad,
        minZ: Math.min(m.z, m.z2) - pad, maxZ: Math.max(m.z, m.z2) + pad,
      };
    })
    .filter(Boolean);

  const overlaps = (a, b) =>
    a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ;

  const sharedEndpointCount = (a, b) => {
    const aPts = [[a.sx, a.sy, a.sz], [a.ex, a.ey, a.ez]];
    const bPts = [[b.sx, b.sy, b.sz], [b.ex, b.ey, b.ez]];
    let count = 0;
    const usedA = new Set(), usedB = new Set();
    for (let ai = 0; ai < aPts.length; ai++) {
      for (let bi = 0; bi < bPts.length; bi++) {
        if (usedA.has(ai) || usedB.has(bi)) continue;
        const [ax, ay, az] = aPts[ai];
        const [bx, by, bz] = bPts[bi];
        if (_dist3(ax, ay, az, bx, by, bz) <= JOINT_SNAP) {
          count++;
          usedA.add(ai);
          usedB.add(bi);
        }
      }
    }
    return count;
  };

  const clashes = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (sharedEndpointCount(a, b) === 1) continue;
      if (overlaps(a, b)) {
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
        const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
        const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
        const minOverlap = Math.min(overlapX, overlapY, overlapZ);
        if (minOverlap > NOMINAL_THICKNESS * 0.3) {
          const severity = minOverlap > NOMINAL_THICKNESS ? "high" : "medium";
          clashes.push({
            a: a.id, b: b.id, aRole: a.role, bRole: b.role,
            aProfile: a.profile, bProfile: b.profile,
            overlap: Math.round(minOverlap), severity,
          });
        }
      }
    }
  }
  return clashes.sort((x, y) => y.overlap - x.overlap);
}

function ClashDetectionPanel({ members }) {
  const clashes = useMemo(() => detectClashes(members), [members]);
  const high   = clashes.filter(c => c.severity === "high");
  const medium = clashes.filter(c => c.severity === "medium");
  return (
    <div className="tab-pane-scroll">
      <div className="audit-header">
        <div>
          <div className="section-title">Clash Detection</div>
          <div className="section-sub">Bounding-box interference check across {members.length} members</div>
        </div>
        <div className="clash-summary-pill">
          <span className="clash-count-high">{high.length} high</span>
          <span className="clash-count-med">{medium.length} medium</span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Detected Clashes ({clashes.length})</span></div>
        <div className="audit-sec-body">
          {clashes.length === 0 && (
            <div className="audit-empty">No geometric clashes detected in the current model.</div>
          )}
          {clashes.map((c, i) => (
            <div key={i} className="clash-row">
              <span className={`sev sev-${c.severity === "high" ? "high" : "med"}`}>
                {c.severity === "high" ? "CLASH" : "NEAR"}
              </span>
              <div>
                <div className="audit-row-label">
                  {c.a} ({c.aRole}, {c.aProfile}) × {c.b} ({c.bRole}, {c.bProfile})
                </div>
                <div className="audit-row-desc">
                  Bounding volumes overlap by approximately {c.overlap}mm in their narrowest axis.
                  {c.severity === "high"
                    ? " Geometric interference is significant — review member routing or coordinates."
                    : " Overlap is within typical connection tolerance, but worth verifying."}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="clash-note">
        Clash detection uses member endpoint bounding boxes with a 150mm nominal
        thickness allowance. Member pairs sharing an endpoint within 50mm are treated
        as valid structural joints and excluded.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DEFECT ANALYSIS PANEL
   ══════════════════════════════════════════════════════════════ */
function detectDefects(members, connections) {
  const defects = [];
  const zeroLen = members.filter(m => m.role !== "CONNECTION" && (!m.length || m.length === 0));
  if (zeroLen.length) defects.push({
    label: "Zero-length members", severity: "high",
    desc: "These members have no measurable length — likely a coincident start/end point or extraction error.",
    impact: "Cannot be analyzed structurally; will break load-path and graph edge detection.",
    fix: "Re-check source geometry in Tekla; verify the member wasn't collapsed during modeling.",
    members: zeroLen.map(m => m.id),
  });
  const invalidCoord = members.filter(m =>
    [m.x, m.y, m.z, m.x2, m.y2, m.z2].some(v => v == null || Number.isNaN(v))
  );
  if (invalidCoord.length) defects.push({
    label: "Invalid or missing coordinates", severity: "high",
    desc: "One or more endpoint coordinates are missing or non-numeric.",
    impact: "Member cannot be positioned in the Network Graph or checked for clashes.",
    fix: "Re-export from Tekla, ensuring StartPoint/EndPoint are populated for every member.",
    members: invalidCoord.map(m => m.id),
  });
  const seen = new Map();
  const duplicates = [];
  members.forEach(m => {
    if (m.x == null) return;
    const key = `${m.x},${m.y},${m.z}|${m.x2},${m.y2},${m.z2}`;
    if (seen.has(key)) duplicates.push(m.id);
    else seen.set(key, m.id);
  });
  if (duplicates.length) defects.push({
    label: "Duplicate geometry", severity: "medium",
    desc: "Multiple members share identical start and end coordinates.",
    impact: "Members overlap visually in the Network Graph. The graph shows a stacked-node badge.",
    fix: "Review and remove redundant members, or confirm they represent genuinely separate elements.",
    members: duplicates,
  });
  if (connections?.by_member) {
    const orphans = members.filter(m =>
      m.role !== "CONNECTION" && (connections.by_member[m.id] || []).length === 0
    );
    if (orphans.length) defects.push({
      label: "Orphan members (no connections)", severity: "medium",
      desc: "These members have no detected structural connections to any other member.",
      impact: "Indicates a floating element, a snap-tolerance gap, or a genuinely isolated/unsupported member.",
      fix: "Verify in the Network Graph; if intentional, no action needed — otherwise check endpoint alignment.",
      members: orphans.map(m => m.id),
    });
  }
  const invalidProfile = members.filter(m => !m.profile || m.profile === "???");
  if (invalidProfile.length) defects.push({
    label: "Missing or invalid profile", severity: "low",
    desc: "Member has no recognizable section profile assigned.",
    impact: "Cannot estimate weight, capacity, or generate fabrication-ready output for this member.",
    fix: "Assign a profile in Tekla before re-running the extractor.",
    members: invalidProfile.map(m => m.id),
  });
  return defects;
}

function DefectAnalysisPanel({ members, connections }) {
  const defects = useMemo(() => detectDefects(members, connections), [members, connections]);
  const high   = defects.filter(d => d.severity === "high");
  const medium = defects.filter(d => d.severity === "medium");
  const low    = defects.filter(d => d.severity === "low");
  return (
    <div className="tab-pane-scroll">
      <div className="audit-header">
        <div>
          <div className="section-title">Defect Analysis</div>
          <div className="section-sub">Model quality checks across {members.length} members</div>
        </div>
        <div className="clash-summary-pill">
          <span className="clash-count-high">{high.length} high</span>
          <span className="clash-count-med">{medium.length} medium</span>
          <span className="clash-count-low">{low.length} low</span>
        </div>
      </div>
      {!connections && (
        <div className="defect-note">
          Connection data unavailable — orphan member detection is skipped until
          the backend's /connections endpoint responds.
        </div>
      )}
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Detected Defects ({defects.length})</span></div>
        <div className="audit-sec-body">
          {defects.length === 0 && (
            <div className="audit-empty">No defects detected — model geometry and connectivity look clean.</div>
          )}
          {defects.map((d, i) => (
            <div key={i} className="audit-row">
              <span className={`sev sev-${d.severity === "high" ? "high" : d.severity === "medium" ? "med" : "ok"}`}>
                {d.severity.toUpperCase()}
              </span>
              <div>
                <div className="audit-row-label">{d.label} ({d.members.length})</div>
                <div className="audit-row-desc">{d.desc}</div>
                <div className="audit-row-desc"><b>Impact:</b> {d.impact}</div>
                <div className="audit-row-desc"><b>Suggested fix:</b> {d.fix}</div>
                <div className="audit-row-members">{d.members.slice(0, 20).join(", ")}{d.members.length > 20 ? ` … +${d.members.length - 20} more` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUDIT PANEL
   ══════════════════════════════════════════════════════════════ */
function AuditPanel({ audit, analytics, members }) {
  const scoreColor = audit.score >= 80 ? "#15803D" : audit.score >= 60 ? "#B45309" : "#B91C1C";

  const dlTxt = () => {
    const lines = [
      "TEKLA AI PLATFORM — STRUCTURAL AUDIT REPORT", "=".repeat(46),
      `Date: ${new Date().toLocaleDateString()}`, `Health Score: ${audit.score}/100`, "",
      `CRITICAL (${audit.critical.length})`, "─".repeat(40),
      ...audit.critical.map(c => `[HIGH] ${c.label}\n  ${c.desc}\n  Members: ${c.members}`),
      `\nWARNINGS (${audit.warnings.length})`, "─".repeat(40),
      ...audit.warnings.map(w => `[WARN] ${w.label}\n  ${w.desc}\n  Members: ${w.members}`),
      `\nPASSED (${audit.passed.length})`, "─".repeat(40),
      ...audit.passed.map(p => `[OK]   ${p}`),
      "\nMODEL ANALYTICS", "─".repeat(40),
      `Top profile: ${analytics.topProfile} (${analytics.topProfileCount}x)`,
      `Top material: ${analytics.topMaterial} (${analytics.topMaterialCount}x)`,
      `Avg length: ${analytics.avgLength}mm`,
      `Total weight: ${analytics.totalWeight}kg`,
      `Complexity: ${analytics.complexity}/100`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "tekla_audit_report.txt"; a.click();
  };

  const dlCsv = () => {
    const rows = [
      ["ID","Role","Profile","Material","Length","Weight","Drawing"],
      ...members.map(m => [m.id,m.role,m.profile,m.material,m.length,m.weight,m.drawing]),
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "tekla_members.csv"; a.click();
  };

  return (
    <div className="tab-pane-scroll">
      <div className="audit-header">
        <div>
          <div className="section-title">Structural Audit Report</div>
          <div className="section-sub">
            Auto-generated · {new Date().toLocaleDateString()} · {members.length} members analysed
          </div>
        </div>
        <div className="audit-score-wrap">
          <div className="score-meta">
            <div className="score-meta-lbl">HEALTH SCORE</div>
            <div className="score-meta-val" style={{ color: scoreColor }}>
              {audit.score >= 80 ? "Good" : audit.score >= 60 ? "Needs Review" : "Critical"}
            </div>
          </div>
          <div className="score-circle" style={{ color: scoreColor, borderColor: scoreColor }}>
            {audit.score}
          </div>
        </div>
      </div>
      <div className="audit-metrics">
        {[
          ["Duplicates",         audit.duplicates,        false],
          ["Missing Profiles",   audit.missingProfiles,   true],
          ["Missing Materials",  audit.missingMaterials,  true],
          ["Drawing Gaps",       audit.drawingMismatches, true],
          ["Unclassified",       audit.unclassified,      true],
          ["Orphan Connections", audit.orphanConnections, false],
        ].map(([l, v, bad]) => (
          <div key={l} className={`metric-chip ${bad && v > 0 ? "metric-bad" : ""}`}>
            <div className="metric-chip-val">{v}</div>
            <div className="metric-chip-lbl">{l}</div>
          </div>
        ))}
      </div>
      {[
        ["Critical Issues", "#B91C1C", audit.critical, "HIGH"],
        ["Warnings",        "#B45309", audit.warnings, "WARN"],
      ].map(([title, color, items, sev]) => (
        <div key={title} className="audit-section">
          <div className="audit-sec-head" style={{ borderLeftColor: color }}>
            <span className="audit-sec-title">{title}</span>
            <span className="audit-sec-count" style={{ color, borderColor: color === "#B91C1C" ? "#FCA5A5" : "#FDE68A" }}>
              {items.length} items
            </span>
          </div>
          <div className="audit-sec-body">
            {items.length === 0 && (
              <div className="audit-empty">No {title.toLowerCase()} — all checks passed.</div>
            )}
            {items.map((c, i) => (
              <div key={i} className="audit-row">
                <span className={`sev sev-${sev === "HIGH" ? "high" : "med"}`}>{sev}</span>
                <div>
                  <div className="audit-row-label">{c.label}</div>
                  <div className="audit-row-desc">{c.desc}</div>
                  <div className="audit-row-members">{c.members}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="audit-section">
        <div className="audit-sec-head" style={{ borderLeftColor: "#15803D" }}>
          <span className="audit-sec-title">Passed Checks</span>
          <span className="audit-sec-count" style={{ color: "#15803D", borderColor: "#BBF7D0" }}>
            {audit.passed.length} items
          </span>
        </div>
        <div className="audit-sec-body">
          {audit.passed.map((p, i) => (
            <div key={i} className="audit-row">
              <span className="sev sev-ok">OK</span>
              <div style={{ fontSize: 12 }}>{p}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Model Analytics</span></div>
        <div className="analytics-grid">
          {[
            ["Most Used Profile",  analytics.topProfile,  `${analytics.topProfileCount} members`],
            ["Most Used Material", analytics.topMaterial, `${analytics.topMaterialCount} members`],
            ["Average Length",  `${analytics.avgLength.toLocaleString()} mm`, null],
            ["Total Steel Weight", `${analytics.totalWeight.toLocaleString()} kg`, null],
            ["Connection Count", analytics.connections, null],
            ["Model Complexity", `${analytics.complexity} / 100`, null],
          ].map(([l, v, s]) => (
            <div key={l} className="analytics-card">
              <div className="ac-lbl">{l}</div>
              <div className="ac-val">{v}</div>
              {s && <div className="ac-sub">{s}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="export-row">
        <button className="dl-btn" onClick={dlTxt}>Download Audit Report</button>
        <button className="dl-btn dl-secondary" onClick={dlCsv}>Export CSV</button>
        <button className="dl-btn dl-secondary" onClick={dlTxt}>Export PDF</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RULE ENGINE PANEL
   ══════════════════════════════════════════════════════════════ */
function RuleEnginePanel({ members }) {
  const [rules,    setRules]    = useState(DEFAULT_RULES.map(r => ({ ...r })));
  const [expanded, setExpanded] = useState({});

  const toggleExpand = id => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const toggleRule   = id => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  return (
    <div className="tab-pane-scroll">
      <div className="rules-header">
        <div>
          <div className="section-title">Rule Engine</div>
          <div className="section-sub">
            IF/THEN structural rules · {rules.filter(r => r.enabled).length} active · {rules.filter(r => !r.enabled).length} disabled
          </div>
        </div>
        <button
          className="btn-sm"
          style={{ borderColor: "#1D4ED8", color: "#1D4ED8" }}
          onClick={() => setExpanded(Object.fromEntries(rules.map(r => [r.id, true])))}
        >
          Run All Rules
        </button>
      </div>
      <div className="rules-list">
        {rules.map(rule => {
          const hits   = rule.enabled ? members.filter(rule.check) : [];
          const isOpen = !!expanded[rule.id];
          const typeColor = rule.type === "error" ? "#B91C1C" : rule.type === "warn" ? "#B45309" : "#1D4ED8";
          const typeLabel = rule.type === "error" ? "ERROR" : rule.type === "warn" ? "WARN" : "SUGGEST";
          return (
            <div key={rule.id} className="rule-card">
              <div className="rule-head" onClick={() => toggleExpand(rule.id)}>
                <span className="rule-name">{rule.name}</span>
                <span className="rule-id">{rule.id}</span>
                <span className="rule-badge" style={{ color: typeColor, borderColor: typeColor }}>{typeLabel}</span>
                {rule.enabled && hits.length > 0 && (
                  <span style={{ fontSize: 11, color: "#B91C1C", fontWeight: 600 }}>
                    {hits.length} hit{hits.length > 1 ? "s" : ""}
                  </span>
                )}
                <button
                  className={`toggle-rule ${rule.enabled ? "on" : "off"}`}
                  onClick={e => { e.stopPropagation(); toggleRule(rule.id); }}
                >
                  {rule.enabled ? "ACTIVE" : "DISABLED"}
                </button>
                <span className="rule-chevron">{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div className="rule-body">
                  <div
                    className="code-block"
                    dangerouslySetInnerHTML={{
                      __html: rule.code
                        .replace(/\bIF\b/g,   '<span class="kw">IF</span>')
                        .replace(/\bAND\b/g,  '<span class="kw">AND</span>')
                        .replace(/\bOR\b/g,   '<span class="kw">OR</span>')
                        .replace(/\bTHEN\b/g, '<span class="then">THEN</span>')
                        .replace(/"([^"]+)"/g, '"<span class="val">$1</span>"')
                        .replace(/(\/\/.+)/g,  '<span class="cmt">$1</span>'),
                    }}
                  />
                  <div className="rule-hits" style={{ marginTop: 10 }}>
                    {!rule.enabled ? (
                      <span style={{ color: "#9B9486", fontSize: 11 }}>Rule is disabled — not evaluated.</span>
                    ) : hits.length ? (
                      <>
                        <span style={{ color: "#B91C1C", fontSize: 11, fontWeight: 600 }}>
                          {hits.length} member(s) match this rule:
                        </span>
                        <div className="hit-list">
                          {hits.map(m => <span key={m.id} className="hit-member">{rule.action(m)}</span>)}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: "#15803D", fontSize: 11, fontWeight: 600 }}>
                        No members match — rule passes cleanly.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GA DRAWINGS PANEL
   ══════════════════════════════════════════════════════════════ */
function DrawingsPanel({ drawings, members }) {
  const [sel, setSel] = useState(null);
  const counts = {
    total:    drawings.length,
    ga:       drawings.filter(d => d.type === "GA").length,
    assembly: drawings.filter(d => d.type === "Assembly").length,
    single:   drawings.filter(d => d.type === "Single Part").length,
  };
  const linked = sel ? members.filter(m => m.drawing === sel.number) : [];
  return (
    <div className="tab-pane-scroll">
      <div style={{ marginBottom: 4 }}>
        <div className="section-title">GA Drawing Register</div>
        <div className="section-sub">General Arrangement drawings — live-linked to the Tekla Structures drawing set</div>
      </div>
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {[
          ["Total",       counts.total,    "#0891B2"],
          ["GA Drawings", counts.ga,       "#1D4ED8"],
          ["Assembly",    counts.assembly, "#6D28D9"],
          ["Single Part", counts.single,   "#B45309"],
        ].map(([lbl, val, col]) => (
          <div key={lbl} className="kpi-card">
            <div className="kpi-stripe" style={{ background: col }} />
            <div className="kpi-val">{val}</div>
            <div className="kpi-lbl">{lbl}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">All Drawings</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Number</th><th>Name</th><th>Type</th><th>Status</th><th>Last Updated</th></tr>
            </thead>
            <tbody>
              {drawings.map(d => (
                <tr key={d.number} className={sel?.number === d.number ? "row-selected" : ""} onClick={() => setSel(d)} style={{ cursor: "pointer" }}>
                  <td className="td-mono">{d.number}</td>
                  <td>{d.name}</td>
                  <td style={{ color: "#6B6658" }}>{d.type}</td>
                  <td><span className={`status-badge status-${d.status.replace(/\s/g, "")}`}>{d.status}</span></td>
                  <td className="td-muted">{d.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {sel && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">{sel.number} — {sel.name}</span>
          </div>
          <div style={{ padding: 14 }}>
            <div className="drawing-meta-row" style={{ marginBottom: 10 }}>
              <span>Status: <b><span className={`status-badge status-${sel.status.replace(/\s/g, "")}`}>{sel.status}</span></b></span>
              <span>Updated: <b>{sel.updated}</b></span>
              <span>Linked members: <b>{linked.length}</b></span>
            </div>
            {linked.length > 0 && (
              <div className="hit-list">
                {linked.map(m => <span key={m.id} className="hit-member">{m.id} — {m.profile}</span>)}
              </div>
            )}
            {linked.length === 0 && (
              <div style={{ fontSize: 12, color: "#9B9486" }}>No members linked to this drawing.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MEMBERS TABLE PANEL
   ══════════════════════════════════════════════════════════════ */
function MembersTablePanel({ members }) {
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [page,    setPage]    = useState(1);
  const PAGE = 10;

  let rows = filter === "all" ? members : members.filter(m => m.role === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter(m =>
      m.id.toLowerCase().includes(q) ||
      m.profile.toLowerCase().includes(q) ||
      (m.material || "").toLowerCase().includes(q)
    );
  }
  rows = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows   = rows.slice((page - 1) * PAGE, page * PAGE);
  const toggleSort = k => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const cols = [
    ["id","Member ID"], ["role","Role"], ["profile","Profile"],
    ["material","Material"], ["length","Length"], ["weight","Weight"], ["drawing","Drawing"],
  ];
  return (
    <div className="tab-pane-scroll">
      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder="Search by ID, profile, or material…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="table-filters">
          {["all","COLUMN","BEAM","SECONDARY","CONNECTION","UNKNOWN"].map(f => (
            <button key={f} className={`btn-sm ${filter === f ? "active" : ""}`} onClick={() => { setFilter(f); setPage(1); }}>
              {f === "all" ? "All" : ROLE_META[f]?.label || f}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                {cols.map(([k, l]) => (
                  <th key={k} onClick={() => toggleSort(k)} style={{ cursor: "pointer" }}>
                    {l} {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                ))}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(m => (
                <tr key={m.id}>
                  <td className="td-mono">{m.id}</td>
                  <td><span className={`badge badge-${m.role}`}>{m.role}</span></td>
                  <td className="td-mono">{m.profile}</td>
                  <td className="td-mono">{m.material || "—"}</td>
                  <td className="td-mono" style={{ textAlign: "right" }}>{m.length ? m.length.toLocaleString() + "mm" : "—"}</td>
                  <td className="td-mono" style={{ textAlign: "right" }}>{m.weight ? m.weight + "kg" : "—"}</td>
                  <td className="td-mono">{m.drawing || "—"}</td>
                  <td>
                    {m.material && m.drawing
                      ? <span className="status-badge status-OK">OK</span>
                      : <span className="status-badge status-Review">Review</span>}
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "#9B9486", padding: "28px 0", fontSize: 12 }}>No members match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{rows.length} members · Page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <button className="btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI ENGINEER CHAT PANEL
   ══════════════════════════════════════════════════════════════ */
function AiEngineerPanel({ online, members, analytics }) {
  const [msgs,     setMsgs]     = useState([{
    role: "ai",
    text: "Structural model loaded. Ask me anything — member counts, profiles, materials, load paths, drawing references, or section recommendations.",
  }]);
  const [chatIn,   setChatIn]   = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs]);

  function localAnswer(msg) {
    const q = msg.toLowerCase();
    if (q.includes("how many beam"))
      return `There are ${members.filter(m => m.role === "BEAM").length} beams in the current model.`;
    if (q.includes("how many column"))
      return `There are ${members.filter(m => m.role === "COLUMN").length} columns in the current model.`;
    if (q.includes("most used profile"))
      return `The most used profile is ${analytics.topProfile} (${analytics.topProfileCount} members).`;
    if (q.includes("material analysis") || q.includes("most used material"))
      return `The most used material grade is ${analytics.topMaterial} (${analytics.topMaterialCount} members).`;
    if (q.includes("average") && q.includes("length"))
      return `The average member length is ${analytics.avgLength.toLocaleString()}mm across ${members.length} members.`;
    if (q.includes("heb")) {
      const h = members.filter(m => m.profile.toUpperCase().startsWith("HEB"));
      return h.length
        ? `Found ${h.length} HEB members: ${h.map(m => m.id).join(", ")}`
        : "No HEB profile members in current model.";
    }
    return null;
  }

  const sendChat = async () => {
    const msg = chatIn.trim();
    if (!msg || chatBusy) return;
    setChatIn(""); setChatBusy(true);
    setMsgs(p => [...p, { role: "user", text: msg }, { role: "typing" }]);
    const local = localAnswer(msg);
    if (local && !online) {
      setTimeout(() => {
        setMsgs(p => [...p.filter(x => x.role !== "typing"), { role: "ai", text: local }]);
        setChatBusy(false);
      }, 600);
      return;
    }
    try {
      const res = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error();
      const r = await res.json();
      setMsgs(p => [...p.filter(x => x.role !== "typing"), {
        role: "ai", text: r.response || r.message || "No response.",
      }]);
    } catch {
      setMsgs(p => [...p.filter(x => x.role !== "typing"), {
        role: "ai",
        text: local || (online ? "Query failed. Check /query endpoint." : "Backend offline — start uvicorn first."),
      }]);
    }
    setChatBusy(false);
  };

  return (
    <div className="panel chat-panel">
      <div className="quick-qs">
        {QUICK_Q.map(q => (
          <button key={q} className="btn-sm" onClick={() => setChatIn(q)}>{q}</button>
        ))}
      </div>
      <div className="chat-msgs" ref={chatRef}>
        {msgs.map((m, i) =>
          m.role === "typing" ? (
            <div key={i} className="msg-ai">
              <div className="ai-lbl">Structural AI</div>
              <div className="typing"><span /><span /><span /></div>
            </div>
          ) : m.role === "user" ? (
            <div key={i} className="msg-user">{m.text}</div>
          ) : (
            <div key={i} className="msg-ai">
              <div className="ai-lbl">Structural AI</div>
              <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
            </div>
          )
        )}
      </div>
      <div className="input-row">
        <textarea
          value={chatIn}
          onChange={e => setChatIn(e.target.value)}
          rows={2}
          placeholder="Ask about load paths, profiles, member counts, or clash detection…"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
        />
        <button className="send-btn" onClick={sendChat} disabled={chatBusy}>
          {chatBusy ? "···" : "Send"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BUILD AGENT PANEL  ←  UPDATED: "Build in Tekla" button added
   ══════════════════════════════════════════════════════════════ */
function BuildAgentPanel({ online, onAction }) {
  const [agentIn,      setAgentIn]      = useState("");
  const [agentBusy,    setAgentBusy]    = useState(false);
  const [agentLog,     setAgentLog]     = useState(null);
  const [teklaLog,     setTeklaLog]     = useState(null);
  const [teklaBusy,    setTeklaBusy]    = useState(false);
  const [teklaPrompt,  setTeklaPrompt]  = useState("");
  const [buildStatus,  setBuildStatus]  = useState(null); // "queued" | "idle" | null

  // Poll build-status while a Tekla build is pending
  useEffect(() => {
    if (buildStatus !== "queued") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/build-status`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const d = await res.json();
          if (!d.pending) {
            setBuildStatus("idle");
            setTeklaLog(prev => ({
              ...prev,
              data: { ...(prev?.data || {}), message: "✅ C# generator has picked up the prompt. Check Tekla for the new structure." }
            }));
            onAction(); // Refresh dashboard
          }
        }
      } catch { /* keep polling */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [buildStatus, onAction]);

  const runAgent = async () => {
    const cmd = agentIn.trim();
    if (!cmd || agentBusy) return;
    setAgentBusy(true); setAgentLog(null);
    try {
      const res = await fetch(`${API}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
        signal: AbortSignal.timeout(20000),
      });
      const r = await res.json();
      setAgentLog({ ok: res.ok, data: r });
      if (res.ok) onAction();
    } catch {
      setAgentLog({ ok: false, data: { message: online ? "Agent endpoint error." : "Backend offline — start uvicorn first." } });
    }
    setAgentBusy(false);
  };

  const buildInTekla = async () => {
    const prompt = teklaPrompt.trim() || agentIn.trim();
    if (!prompt || teklaBusy) return;
    setTeklaBusy(true); setTeklaLog(null); setBuildStatus(null);
    try {
      const res = await fetch(`${API}/build-structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(10000),
      });
      const r = await res.json();
      if (res.ok) {
        setBuildStatus("queued");
        setTeklaLog({
          ok: true,
          data: {
            message: `🏗 Prompt queued for Tekla Structures. C# program will pick it up within 2 seconds and build "${prompt}".`,
            prompt: r.prompt,
            status: r.status,
          }
        });
      } else {
        setTeklaLog({ ok: false, data: r });
      }
    } catch {
      setTeklaLog({ ok: false, data: { message: online ? "Could not reach /build-structure endpoint." : "Backend offline — start uvicorn first." } });
    }
    setTeklaBusy(false);
  };

  return (
    <div className="panel agent-panel">
      <div className="agent-body">

        {/* ── SECTION 1: Dashboard Agent (output.json only) ── */}
        <div>
          <div className="section-lbl" style={{ marginBottom: 6 }}>
            Dashboard Agent — updates <code>output.json</code>
          </div>
          <div className="section-sub" style={{ fontSize: 11, color: "#6B6658", marginBottom: 8 }}>
            Creates/deletes members in the dashboard model. Does NOT create geometry in Tekla Structures.
          </div>
          <div className="agent-preset">
            {AGENT_PRESETS.map(p => (
              <button key={p} className="btn-sm" onClick={() => setAgentIn(p)}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-lbl">Command Syntax</div>
          <div className="code-block">
            <span className="kw">create</span> beam|column [profile] [material]{"\n"}
            {"  "}<span className="cmt">{"→ create beam IPE300 S275"}</span>{"\n\n"}
            <span className="kw">delete</span> all unknown|beam|column|secondary{"\n"}
            {"  "}<span className="cmt">{"→ delete all unknown members"}</span>{"\n\n"}
            <span className="kw">list</span>{"   "}drawings{"\n"}
            <span className="kw">suggest</span>{"  "}sections
          </div>
        </div>

        {agentLog && (
          <div>
            <div className="section-lbl">{agentLog.ok ? "Agent Result" : "Agent Error"}</div>
            <div className={`agent-result ${agentLog.ok ? "ok" : "err"}`}>
              {JSON.stringify(agentLog.data, null, 2)}
            </div>
          </div>
        )}

        {/* ── SECTION 2: Build in Tekla Structures ── */}
        <div style={{ borderTop: "1px solid #E8E3DC", paddingTop: 16, marginTop: 4 }}>
          <div className="section-lbl" style={{ marginBottom: 6 }}>
            🏗 Build in Tekla Structures — physically creates geometry
          </div>
          <div className="section-sub" style={{ fontSize: 11, color: "#6B6658", marginBottom: 8 }}>
            Sends a natural-language prompt to the running C# program, which calls StructureGenerator to build it in the live Tekla model.
            Requires <code>dotnet run</code> to be active.
          </div>

          <div className="agent-preset" style={{ marginBottom: 10 }}>
            {TEKLA_PRESETS.map(p => (
              <button key={p} className="btn-sm" style={{ borderColor: "#1D4ED8", color: "#1D4ED8" }}
                onClick={() => setTeklaPrompt(p)}>
                {p}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="agent-input"
              value={teklaPrompt}
              onChange={e => setTeklaPrompt(e.target.value)}
              placeholder="e.g.  portal frame with haunch  ·  x bracing height 4m"
              onKeyDown={e => { if (e.key === "Enter") buildInTekla(); }}
              style={{ borderColor: "#1D4ED8" }}
            />
            <button className="btn-sm" onClick={() => setTeklaPrompt("")}>Clear</button>
          </div>

          <button
            style={{
              width: "100%",
              padding: "10px 0",
              background: online ? "#1D4ED8" : "#C4BCAF",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: online ? "pointer" : "not-allowed",
              letterSpacing: "0.03em",
              marginBottom: 8,
            }}
            onClick={buildInTekla}
            disabled={teklaBusy || !online}
          >
            {teklaBusy
              ? "Sending to Tekla…"
              : buildStatus === "queued"
              ? "⏳ Waiting for C# pickup…"
              : online
              ? "🏗 Build in Tekla Structures"
              : "Connect Backend First"}
          </button>

          {teklaLog && (
            <div className={`agent-result ${teklaLog.ok ? "ok" : "err"}`} style={{ marginBottom: 0 }}>
              {teklaLog.ok
                ? teklaLog.data.message
                : JSON.stringify(teklaLog.data, null, 2)}
            </div>
          )}

          {buildStatus === "queued" && (
            <div style={{ fontSize: 11, color: "#1D4ED8", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#1D4ED8", animation: "pulse 1.2s infinite" }} />
              Polling for C# confirmation…
            </div>
          )}
          {buildStatus === "idle" && (
            <div style={{ fontSize: 11, color: "#15803D", marginTop: 6, fontWeight: 600 }}>
              ✅ Build complete — check Tekla and press Ctrl+F5 to refresh.
            </div>
          )}
        </div>

        {!online && (
          <div className="offline-help">
            <div className="section-lbl" style={{ marginBottom: 8 }}>Connect FastAPI Backend</div>
            <div className="code-block" style={{ background: "#FFF5F5" }}>
              <span className="cmt"># Step 1</span>{"\n"}cd TeklaExtractor{"\n\n"}
              <span className="cmt"># Step 2</span>{"\n"}pip install fastapi uvicorn{"\n\n"}
              <span className="cmt"># Step 3</span>{"\n"}uvicorn main:app --reload{"\n\n"}
              <span className="cmt"># Step 4 — in another terminal</span>{"\n"}dotnet run
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom agent input bar (Dashboard Agent) ── */}
      <div className="agent-input-wrap">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="agent-input"
            value={agentIn}
            onChange={e => setAgentIn(e.target.value)}
            placeholder="Dashboard agent: create beam IPE300 S275 · delete all unknown"
            onKeyDown={e => { if (e.key === "Enter") runAgent(); }}
          />
          <button className="btn-sm" onClick={() => setAgentIn("")}>Clear</button>
        </div>
        <button
          className="full-btn"
          onClick={runAgent}
          disabled={agentBusy || !online}
        >
          {agentBusy ? "Processing…" : online ? "Execute Dashboard Command" : "Connect Backend First"}
        </button>
      </div>
    </div>
  );
}