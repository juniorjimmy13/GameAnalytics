import { useState, useEffect, useRef,useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ADMIN_API_KEY = import.meta.env.VITE_TENANT_API_KEY;
const TENANT_BASE   = import.meta.env.VITE_TENANT_BASE;
const ADMIN_BASE    = import.meta.env.VITE_ADMIN_BASE;

const makeTenantFetch = (key) => (path) =>
  fetch(`${TENANT_BASE}${path}`, { headers: { Authorization: `Bearer ${key}` } })
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });

const adminFetch = (path) =>
  fetch(`${ADMIN_BASE}${path}`, { headers: { Authorization: `Bearer ${ADMIN_API_KEY}` } })
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmt = (v) => {
  if (v == null) return "—";
  if (v >= 100_000_000) return `$${(v / 100_000_000).toFixed(2)}M`;
  if (v >= 10_000)      return `$${(v / 100_000).toFixed(1)}K`;
  return `$${(v / 100).toFixed(2)}`;
};
const fmtAxis = (v) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};
const pct = (a, b) => (!b ? "—" : `${((a / b) * 100).toFixed(1)}%`);

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
const T = {
  bg:       "#F4F6F9",
  surface:  "#FFFFFF",
  card:     "#FFFFFF",
  border:   "#E2E8F0",
  text:     "#1E293B",
  muted:    "#64748B",
  faint:    "#E2E8F0",
  teal:     "#0EA5A0",
  blue:     "#2563EB",
  amber:    "#D97706",
  coral:    "#E11D48",
  purple:   "#7C3AED",
  green:    "#16A34A",
};

const ACCENTS = [T.teal, T.blue, T.amber, T.coral, T.purple];

// ─── CUSTOM TOOLTIP ────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 14px" }}>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{fmt(payload[0].value)}</div>
    </div>
  );
};

// ─── KPI CARD ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, delta }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      borderTop: `2px solid ${accent}`,
      flex: 1,
    }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: T.muted }}>{sub}</span>
        {delta && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: delta.startsWith("+") ? "#15803D" : T.coral,
            background: delta.startsWith("+") ? "#DCFCE7" : "#FFF1F2",
            borderRadius: 4, padding: "1px 6px",
          }}>{delta}</span>
        )}
      </div>
    </div>
  );
}

// ─── PANEL WRAPPER ─────────────────────────────────────────────────────────
function Panel({ title, accent = T.teal, children, style }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      ...style,
    }}>
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ width: 3, height: 13, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "10px 14px 10px" }}>
        {children}
      </div>
    </div>
  );
}

// ─── SKELETON ──────────────────────────────────────────────────────────────
function Skel({ h = 100 }) {
  return (
    <div style={{
      height: h, borderRadius: 6,
      background: `linear-gradient(90deg,#E9EDF2 25%,#F3F5F8 50%,#E9EDF2 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

// ─── FUNNEL BAR ────────────────────────────────────────────────────────────
function FunnelBar({ label, count, total, color }) {
  const w = total ? `${((count / total) * 100).toFixed(1)}%` : "0%";
  const p = total ? `${((count / total) * 100).toFixed(0)}%` : "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 70, fontSize: 11, color: T.muted, textAlign: "right", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 22, background: T.faint, borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ width: w, height: "100%", background: color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, transition: "width 0.6s ease" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>{count?.toLocaleString()}</span>
        </div>
      </div>
      <div style={{ width: 36, fontSize: 11, color: T.muted, textAlign: "right", flexShrink: 0 }}>{p}</div>
    </div>
  );
}

// ─── SPINNER ───────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 0.75s linear infinite" }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [key, setKey]     = useState("");
  const [show, setShow]   = useState(false);
  const [err, setErr]     = useState("");
  const [busy, setBusy]   = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  async function submit(e) {
    e.preventDefault();
    const k = key.trim();
    if (!k) { setErr("Please enter your tenant API key."); return; }
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`${TENANT_BASE}/summary`, { headers: { Authorization: `Bearer ${k}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onLogin(k);
    } catch (ex) {
      setErr(`Invalid key or server unreachable (${ex.message}).`);
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: T.bg }}>
      {/* Left brand panel */}
      <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 56px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", border: `1px solid ${T.border}` }} />
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", border: `1px solid ${T.faint}` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: T.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>JR</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: 0.3 }}>Monetization</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2 }}>ANALYTICS SUITE</div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ width: 36, height: 2, background: T.teal, borderRadius: 1, marginBottom: 24 }} />
          <h1 style={{ fontSize: 38, fontWeight: 800, color: T.text, lineHeight: 1.15, letterSpacing: -1, marginBottom: 18, fontFamily: "system-ui" }}>
            Revenue insights,<br /><span style={{ color: T.teal }}>always on.</span>
          </h1>
          <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, maxWidth: 320 }}>
            Real-time analytics for game monetization — revenue, conversion, product rankings, and peer benchmarks in one snapshot.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
            {["Revenue Metrics", "Conversion Funnel", "Product Rankings", "Competitive Rank", "Admin Platform"].map(f => (
              <span key={f} style={{ fontSize: 10, padding: "4px 11px", borderRadius: 20, border: `1px solid ${T.faint}`, color: T.muted, letterSpacing: 0.5 }}>{f}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5 }}>CONFIDENTIAL · AUTHORIZED TENANTS ONLY</div>
      </div>

      {/* Right form */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 72px", background: T.bg }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text, marginBottom: 8 }}>Sign in to your dashboard</h2>
          <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 36 }}>Enter your tenant API key to access analytics.</p>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>Tenant API Key</label>
              <div style={{ position: "relative" }}>
                <input
                  ref={ref}
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={e => { setKey(e.target.value); setErr(""); }}
                  placeholder="tk_live_••••••••••••••••"
                  autoComplete="off"
                  style={{
                    width: "100%", padding: "12px 52px 12px 14px",
                    border: `1px solid ${err ? "#F43F5E" : T.border}`,
                    borderRadius: 8, background: T.surface,
                    fontSize: 13, color: T.text, outline: "none",
                    fontFamily: "monospace", letterSpacing: show ? 0 : 2,
                  }}
                />
                <button type="button" onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 10, color: T.muted, letterSpacing: 1 }}>{show ? "HIDE" : "SHOW"}</button>
              </div>
              {err && <p style={{ marginTop: 6, fontSize: 11, color: T.coral }}>{err}</p>}
            </div>
            <button
              type="submit"
              disabled={!key.trim() || busy}
              style={{
                width: "100%", padding: "13px", background: (key.trim() && !busy) ? T.teal : "#CBD5E1",
                border: "none", borderRadius: 8, color: "#fff",
                fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
                cursor: (key.trim() && !busy) ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >{busy ? <><Spinner />VERIFYING…</> : "ACCESS DASHBOARD →"}</button>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontSize: 10, color: T.muted, letterSpacing: 1 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>
          <button
            onClick={() => onLogin(null)}
            style={{
              width: "100%", padding: "12px", background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: 8,
              color: T.blue, fontSize: 12, fontWeight: 700,
              letterSpacing: 1.2, cursor: "pointer",
            }}
          >CONTINUE AS PLATFORM ADMIN →</button>
          <p style={{ marginTop: 24, fontSize: 10, color: T.muted, textAlign: "center", lineHeight: 1.8 }}>
            Your key lives in memory only — never stored or transmitted elsewhere.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── TENANT DASHBOARD ──────────────────────────────────────────────────────
function TenantDashboard({ tenantFetch }) {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setBusy(true);
    Promise.allSettled([
      tenantFetch("/summary"),
      tenantFetch("/revenue-timeseries"),
      tenantFetch("/top-products"),
    ]).then(([ov, ts, tp]) => {
      setData({
        overview:    ov.status === "fulfilled" ? ov.value : null,
        timeseries:  ts.status === "fulfilled" ? ts.value : [],
        topProducts: tp.status === "fulfilled" ? tp.value : [],
      });
      setBusy(false);
    });
  }, [tenantFetch]);

  const { overview, timeseries = [], topProducts = [] } = data;
  const chartData = timeseries.map(r => ({
    date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    revenue: r.revenue ?? 0,
  }));

  const conv     = overview ? pct(overview.paidOrders, overview.orders) : "—";
  const failed   = overview ? (overview.orders ?? 0) - (overview.paidOrders ?? 0) : 0;
  const total    = overview?.orders ?? 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gridTemplateRows: "auto 1fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>

      {/* KPI row — spans full 12 cols */}
      <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {busy
          ? [0,1,2,3].map(i => <Skel key={i} h={96} />)
          : <>
              <KpiCard label="Total Revenue"  value={fmt(overview?.revenue)}  sub="This period"    accent={T.teal}   delta="+12%" />
              <KpiCard label="Total Orders"   value={overview?.orders ?? "—"} sub="All attempts"   accent={T.blue}   />
              <KpiCard label="Paid Orders"    value={overview?.paidOrders ?? "—"}   sub="Successful"     accent={T.amber}  />
              <KpiCard label="Conversion"     value={conv}                    sub={`${overview?.paid ?? 0} of ${total}`} accent={T.coral} delta="+2.1%" />
            </>
        }
      </div>

      {/* Row 2: Area chart (8 cols) + Funnel (4 cols) */}
      <Panel title="Revenue Timeline" accent={T.teal} style={{ gridColumn: "1/9", gridRow: "2/3" }}>
        {busy ? <Skel h="100%" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.teal} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.faint} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" stroke={T.teal} strokeWidth={2} fill="url(#tGrad)" dot={false} activeDot={{ r: 4, fill: T.teal, stroke: T.card, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Payment Funnel" accent={T.blue} style={{ gridColumn: "9/13", gridRow: "2/3" }}>
        {busy ? <Skel h="100%" /> : (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", height: "100%" }}>
            <FunnelBar label="Initiated"  count={total}                color={T.muted} total={total} />
            <FunnelBar label="Paid"       count={overview?.paid}       color={T.teal}  total={total} />
            <FunnelBar label="Failed"     count={failed}               color={T.coral} total={total} />
          </div>
        )}
      </Panel>

      {/* Row 3: Top Products bar (8 cols) + Quick stats (4 cols) */}
      <Panel title="Top Products by Revenue" accent={T.amber} style={{ gridColumn: "1/9", gridRow: "3/4" }}>
        {busy ? <Skel h="100%" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical" barSize={14} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis type="number" tickFormatter={fmtAxis} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="sku" tick={{ fill: T.text, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
                {topProducts.map((_, i) => <Cell key={i} fill={ACCENTS[i % ACCENTS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Snapshot" accent={T.purple} style={{ gridColumn: "9/13", gridRow: "3/4" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, height: "100%" }}>
          {[
            { label: "Avg Order Value", val: overview ? fmt(Math.round((overview.revenue ?? 0) / (overview.orders || 1))) : "—", accent: T.teal },
            { label: "Fail Rate",       val: overview ? pct(failed, total) : "—",       accent: T.coral },
            { label: "Top SKU",         val: topProducts[0]?.sku ?? "—",                accent: T.amber },
            { label: "Products",        val: topProducts.length || "—",                  accent: T.purple },
          ].map(s => (
            <div key={s.label} style={{ background: T.bg, borderRadius: 6, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.accent, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.val}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── ADMIN DASHBOARD ───────────────────────────────────────────────────────
function AdminDashboard() {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setBusy(true);
    Promise.allSettled([
      adminFetch("/overview"),
      adminFetch("/revenue-timeseries"),
      adminFetch("/top-tenants"),
      adminFetch("/top-products"),
    ]).then(([ov, ts, tt, tp]) => {
      setData({
        overview:    ov.status === "fulfilled" ? ov.value : null,
        timeseries:  ts.status === "fulfilled" ? ts.value : [],
        topTenants:  tt.status === "fulfilled" ? tt.value : [],
        topProducts: tp.status === "fulfilled" ? tp.value : [],
      });
      setBusy(false);
    });
  }, []);

  const { overview, timeseries = [], topTenants = [], topProducts = [] } = data;
  const chartData = timeseries.map(r => ({
    date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    revenue: r.revenue ?? 0,
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gridTemplateRows: "auto 1fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>

      <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {busy
          ? [0,1,2,3].map(i => <Skel key={i} h={96} />)
          : <>
              <KpiCard label="Platform Revenue" value={fmt(overview?.revenue)}       sub="All tenants"   accent={T.blue}   delta="+8%" />
              <KpiCard label="Total Orders"      value={overview?.orders ?? "—"}     sub="Platform-wide" accent={T.teal}   />
              <KpiCard label="Paid Orders"       value={overview?.paidOrders ?? "—"} sub="Converted"     accent={T.amber}  />
              <KpiCard label="Active Tenants"    value={overview?.tenants ?? "—"}    sub="Live games"    accent={T.purple} />
            </>
        }
      </div>

      <Panel title="Platform Revenue Timeline" accent={T.blue} style={{ gridColumn: "1/9", gridRow: "2/3" }}>
        {busy ? <Skel h="100%" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.blue} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.faint} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="revenue" stroke={T.blue} strokeWidth={2} fill="url(#aGrad)" dot={false} activeDot={{ r: 4, fill: T.blue, stroke: T.card, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Tenant Leaderboard" accent={T.amber} style={{ gridColumn: "9/13", gridRow: "2/3" }}>
        {busy ? <Skel h="100%" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, height: "100%", overflowY: "auto" }}>
            {topTenants.slice(0, 6).map((t, i) => {
              const barW = topTenants[0]?.revenue ? ((t.revenue / topTenants[0].revenue) * 100).toFixed(0) : 0;
              const rc   = ["#F59E0B","#94A3B8","#CD7F32",T.blue,T.teal,T.purple][i] ?? T.muted;
              return (
                <div key={t.tenantId ?? i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: rc, textAlign: "center", flexShrink: 0 }}>#{i+1}</span>
                  <span style={{ flex: 1, fontSize: 11, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.tenantId}</span>
                  <div style={{ width: 60, height: 5, background: T.faint, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${barW}%`, height: "100%", background: rc, borderRadius: 3 }} />
                  </div>
                  <span style={{ width: 50, fontSize: 11, color: T.muted, textAlign: "right", flexShrink: 0 }}>{fmt(t.revenue)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Global Top Products" accent={T.coral} style={{ gridColumn: "1/-1", gridRow: "3/4" }}>
        {busy ? <Skel h="100%" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} barSize={28} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.faint} vertical={false} />
              <XAxis dataKey="sku" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {topProducts.map((_, i) => <Cell key={i} fill={ACCENTS[i % ACCENTS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}

// ─── RANK VIEW ─────────────────────────────────────────────────────────────
function TenantRankView({ tenantFetch }) {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setBusy(true);
    Promise.allSettled([
      adminFetch("/top-tenants"),
      tenantFetch("/summary"),
    ]).then(([tt, ov]) => {
      setData({
        tenants:  tt.status === "fulfilled" ? tt.value : [],
        overview: ov.status === "fulfilled" ? ov.value : null,
      });
      setBusy(false);
    });
  }, [tenantFetch]);

  const { tenants = [], overview } = data;
  const ranked = tenants.map((t, i) => ({ ...t, rank: i + 1 }));
  const myIdx  = ranked.findIndex(t => t.revenue === overview?.revenue);
  const me     = ranked[myIdx >= 0 ? myIdx : 0];
  const leader = ranked[0];

  const RANK_COLORS = ["#F59E0B","#94A3B8","#CD7F32",T.blue,T.teal];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gridTemplateRows: "auto 1fr", gap: 8, height: "100%", minHeight: 0 }}>

      {/* My rank hero */}
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
        {busy ? <Skel h={110} /> : me && (
          <>
            <div style={{
              background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.amber}`,
              borderRadius: 8, padding: "16px 28px", display: "flex", alignItems: "center", gap: 28, flex: 1,
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 56, fontWeight: 800, color: RANK_COLORS[myIdx] ?? T.muted, lineHeight: 1, letterSpacing: -2 }}>#{me.rank}</div>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, marginTop: 2 }}>YOUR RANK</div>
              </div>
              <div style={{ width: 1, height: 56, background: T.border }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 10 }}>{me.tenantId}</div>
                <div style={{ display: "flex", gap: 28 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.amber }}>{fmt(me.revenue)}</div>
                    <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: "uppercase" }}>Revenue</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.blue }}>{me.orders}</div>
                    <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: "uppercase" }}>Orders</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.teal }}>{pct(me.revenue, overview?.revenue)}</div>
                    <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: "uppercase" }}>Platform Share</div>
                  </div>
                </div>
              </div>
              {leader && me.rank > 1 && (
                <div style={{ marginLeft: "auto", background: "#FFF1F2", border: `1px solid #FECDD3`, borderRadius: 8, padding: "12px 20px", textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: T.muted, marginBottom: 4, letterSpacing: 1 }}>VS LEADER</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.coral }}>-{pct(leader.revenue - me.revenue, leader.revenue)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{fmt(leader.revenue - me.revenue)} gap</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Leaderboard */}
      <Panel title="Full Leaderboard" accent={T.amber} style={{ gridColumn: "1/-1", gridRow: "2/3" }}>
        {busy ? <Skel h="100%" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", overflowY: "auto" }}>
            {ranked.map((t, i) => {
              const isMe = i === (myIdx >= 0 ? myIdx : 0);
              const barW = ranked[0]?.revenue ? ((t.revenue / ranked[0].revenue) * 100).toFixed(0) : 0;
              const rc   = RANK_COLORS[i] ?? T.muted;
              return (
                <div key={t.tenantId ?? i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "9px 12px",
                  borderRadius: 6,
                  background: isMe ? `${T.amber}12` : "transparent",
                  borderLeft: isMe ? `3px solid ${T.amber}` : "3px solid transparent",
                  marginBottom: 2,
                }}>
                  <span style={{ width: 22, fontSize: 13, fontWeight: 700, color: rc, textAlign: "center" }}>#{t.rank}</span>
                  <span style={{ flex: "0 0 160px", fontSize: 12, color: isMe ? T.text : T.muted, fontWeight: isMe ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
                    {t.tenantId}
                    {isMe && <span style={{ fontSize: 9, background: T.amber, color: "#000", borderRadius: 3, padding: "1px 5px", letterSpacing: 1.5, fontWeight: 700 }}>YOU</span>}
                  </span>
                  <div style={{ flex: 1, height: 6, background: T.faint, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${barW}%`, height: "100%", background: isMe ? T.amber : rc, borderRadius: 3, opacity: isMe ? 1 : 0.6 }} />
                  </div>
                  <span style={{ width: 60, fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? T.amber : T.muted, textAlign: "right" }}>{fmt(t.revenue)}</span>
                  <span style={{ width: 50, fontSize: 11, color: T.muted, textAlign: "right" }}>{pct(t.revenue, ranked[0]?.revenue)}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 9, color: T.faint, textAlign: "center", marginTop: 8, letterSpacing: 1 }}>COMPETITOR NAMES ANONYMIZED · REFRESHES DAILY</div>
      </Panel>
    </div>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [tenantKey, setTenantKey] = useState(null);
  const [mode, setMode]           = useState("tenant");
  const [time, setTime]           = useState("");

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const activeTenantFetch = useCallback(
  makeTenantFetch(typeof tenantKey === "string" ? tenantKey : ADMIN_API_KEY),
  [tenantKey]
);

  function handleLogin(key) {
    if (key === null) { setTenantKey(false); setMode("admin"); }
    else              { setTenantKey(key);   setMode("tenant"); }
  }

  if (tenantKey === null) return <LoginScreen onLogin={handleLogin} />;

  const isAdminOnly = tenantKey === false;
  const tabs = [
    ...(!isAdminOnly ? [
      { id: "tenant", label: "Game Dashboard", accent: T.teal },
      { id: "rank",   label: "My Rank",        accent: T.amber },
    ] : []),
    { id: "admin", label: "Admin Platform", accent: T.blue },
  ];
  const currentAccent = tabs.find(t => t.id === mode)?.accent ?? T.teal;
  const maskedKey = typeof tenantKey === "string" ? `${tenantKey.slice(0, 8)}••••` : "Admin";

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; background: ${T.bg}; }
      `}</style>

      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        color: T.text,
        fontFamily: "'DM Mono', 'Courier New', monospace",
        overflow: "hidden",
      }}>
        {/* ── Topbar ── */}
        <div style={{
          height: 48,
          flexShrink: 0,
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: currentAccent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", transition: "background 0.3s" }}>JR</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1 }}>Monetization</div>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2 }}>ANALYTICS SUITE</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 3 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setMode(tab.id)} style={{
                padding: "5px 18px", borderRadius: 5, border: "none", cursor: "pointer",
                background: mode === tab.id ? T.surface : "transparent",
                color: mode === tab.id ? tab.accent : T.muted,
                fontSize: 11, fontWeight: mode === tab.id ? 700 : 400,
                borderBottom: mode === tab.id ? `2px solid ${tab.accent}` : "2px solid transparent",
                transition: "all 0.15s", whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}>{tab.label}</button>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "3px 12px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: currentAccent }} />
              <span style={{ fontSize: 10, color: T.muted }}>{maskedKey}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 20, padding: "3px 10px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green }} />
              <span style={{ fontSize: 10, color: "#15803D", letterSpacing: 1 }}>LIVE</span>
            </div>
            <span style={{ fontSize: 11, color: T.muted, fontFamily: "monospace" }}>{time}</span>
            <button onClick={() => setTenantKey(null)} style={{
              padding: "4px 12px", borderRadius: 5, border: `1px solid ${T.border}`,
              background: "transparent", color: T.muted, fontSize: 10,
              cursor: "pointer", fontFamily: "inherit", letterSpacing: 1,
            }}>SIGN OUT</button>
          </div>
        </div>

        {/* ── Page title bar ── */}
        <div style={{ height: 44, flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              {mode === "tenant" ? "Game Developer Dashboard" : mode === "admin" ? "Platform Administration" : "Competitive Rankings"}
            </h1>
            <p style={{ fontSize: 10, color: T.muted }}>
              {mode === "tenant" ? "Monetization performance snapshot" : mode === "admin" ? "Cross-tenant analytics" : "How you rank against peers"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["7D","30D","90D","ALL"].map(r => (
              <button key={r} style={{
                padding: "4px 12px", borderRadius: 5,
                border: `1px solid ${r === "30D" ? currentAccent : T.border}`,
                background: r === "30D" ? `${currentAccent}22` : "transparent",
                color: r === "30D" ? currentAccent : T.muted,
                fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                fontWeight: r === "30D" ? 700 : 400,
              }}>{r}</button>
            ))}
          </div>
        </div>

        {/* ── Main content (fills rest, no scroll) ── */}
        <main style={{ flex: 1, minHeight: 0, padding: "10px", overflow: "hidden" }}>
          {mode === "tenant" && !isAdminOnly && <TenantDashboard tenantFetch={activeTenantFetch} />}
          {mode === "admin"  && <AdminDashboard />}
          {mode === "rank"   && !isAdminOnly && <TenantRankView tenantFetch={activeTenantFetch} />}
        </main>

        {/* ── Footer ── */}
        <div style={{ height: 28, flexShrink: 0, borderTop: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <span style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>MONETIZATION ANALYTICS · CONFIDENTIAL</span>
          <span style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>DATA REFRESHES EVERY 24H</span>
        </div>
      </div>
    </>
  );
}