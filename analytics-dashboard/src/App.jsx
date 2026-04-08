import { useState, useEffect, useRef } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area
} from "recharts";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const ADMIN_API_KEY  = import.meta.env.VITE_TENANT_API_KEY;   // always from env
const TENANT_BASE    = import.meta.env.VITE_TENANT_BASE;
const ADMIN_BASE     = import.meta.env.VITE_ADMIN_BASE;

// Both tenant + admin use the same Bearer pattern; tenant key is injected at login
const makeTenantFetch = (key) => (path) =>
  fetch(`${TENANT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  }).then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.url}`); return r.json(); });

const adminFetch = (path) =>
  fetch(`${ADMIN_BASE}${path}`, {
    headers: { Authorization: `Bearer ${ADMIN_API_KEY}` },
  }).then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.url}`); return r.json(); });

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (minor) => {
  if (minor == null) return "—";
  if (minor >= 100_000_000) return `$${(minor / 100_000_000).toFixed(2)}M`;
  if (minor >= 10_000)      return `$${(minor / 100_000).toFixed(1)}K`;
  return `$${(minor / 100).toFixed(2)}`;
};
const fmtAxis = (v) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};
const pct = (a, b) => (!b || b === 0) ? "—" : `${((a / b) * 100).toFixed(1)}%`;

const PALETTE = {
  navy:    "#1A2744",
  slate:   "#374151",
  mid:     "#6B7280",
  light:   "#9CA3AF",
  border:  "#E5E7EB",
  bg:      "#F8F9FB",
  surface: "#FFFFFF",
  gold:    "#B8972E",
  teal:    "#0D7377",
  rose:    "#C2344D",
  indigo:  "#3B52A4",
  amber:   "#D97706",
};

const ACCENT_COLORS = [PALETTE.teal, PALETTE.indigo, PALETTE.gold, PALETTE.rose, PALETTE.amber];
const RANK_COLORS   = ["#B8972E", "#9CA3AF", "#CD7F32", "#3B52A4", "#0D7377"];

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { font-size: 16px; }
      body { background: ${PALETTE.bg}; color: ${PALETTE.slate}; font-family: 'DM Mono', monospace; -webkit-font-smoothing: antialiased; }
      ::-webkit-scrollbar { width: 5px; }
      ::-webkit-scrollbar-track { background: ${PALETTE.bg}; }
      ::-webkit-scrollbar-thumb { background: ${PALETTE.border}; border-radius: 3px; }
      @keyframes shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `}</style>
  );
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = PALETTE.teal, icon }) {
  return (
    <div style={{
      background: PALETTE.surface,
      border: `1px solid ${PALETTE.border}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 8,
      padding: "22px 24px 18px",
      display: "flex", flexDirection: "column", gap: 8,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
          color: PALETTE.light, fontFamily: "'DM Mono',monospace", fontWeight: 500,
        }}>{label}</span>
        <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>
      </div>
      <span style={{
        fontSize: 32, fontWeight: 700, color: PALETTE.navy,
        fontFamily: "'Playfair Display',serif", lineHeight: 1, letterSpacing: -1,
      }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: accent, fontFamily: "'DM Mono',monospace" }}>{sub}</span>}
    </div>
  );
}

function SectionHeader({ children, accent = PALETTE.teal, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 3, height: 16, background: accent, borderRadius: 2 }} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: PALETTE.navy,
          fontFamily: "'Playfair Display',serif", letterSpacing: 0.3,
        }}>{children}</span>
      </div>
      {description && (
        <p style={{ fontSize: 11, color: PALETTE.light, fontFamily: "'DM Mono',monospace", marginLeft: 13 }}>{description}</p>
      )}
    </div>
  );
}

const ChartTooltipUI = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: PALETTE.navy, borderRadius: 6,
      padding: "10px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>{label}</p>
      <p style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

function Skeleton({ h = 180 }) {
  return (
    <div style={{
      height: h, borderRadius: 8,
      background: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6,
      padding: "10px 14px", color: "#991B1B",
      fontFamily: "'DM Mono',monospace", fontSize: 11, marginBottom: 12,
    }}>⚠ {msg}</div>
  );
}

function Empty({ msg = "No data available yet." }) {
  return (
    <div style={{
      color: PALETTE.light, fontFamily: "'DM Mono',monospace", fontSize: 11,
      padding: "40px 24px", textAlign: "center",
      border: `1px dashed ${PALETTE.border}`, borderRadius: 8,
      background: PALETTE.bg,
    }}>{msg}</div>
  );
}

function ChartCard({ children, style }) {
  return (
    <div style={{
      background: PALETTE.surface,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 8,
      padding: "20px 16px 14px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      ...style,
    }}>{children}</div>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 0.75s linear infinite" }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7" fill="none" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [key, setKey]         = useState("");
  const [show, setShow]       = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) { setError("Please enter your tenant API key."); return; }
    setError("");
    setLoading(true);

    // Validate key by probing the summary endpoint
    try {
      const res = await fetch(`${TENANT_BASE}/summary`, {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onLogin(trimmed);
    } catch (err) {
      setError(`Invalid key or server unreachable (${err.message}). Please try again.`);
      setLoading(false);
    }
  }

  const canSubmit = key.trim().length > 0 && !loading;

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
    }}>
      {/* ── Left: brand panel ── */}
      <div style={{
        background: PALETTE.navy,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "52px 56px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative rings */}
        {[
          { t: -120, r: -120, s: 500 },
          { t: -60,  r: -60,  s: 340 },
          { b: -80,  l: -80,  s: 400 },
        ].map((ring, i) => (
          <div key={i} style={{
            position: "absolute",
            top: ring.t, right: ring.r, bottom: ring.b, left: ring.l,
            width: ring.s, height: ring.s,
            borderRadius: "50%",
            border: `1px solid rgba(255,255,255,${i === 2 ? 0.04 : i === 1 ? 0.07 : 0.05})`,
          }} />
        ))}

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: PALETTE.teal,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#FFF",
            fontFamily: "'DM Mono',monospace", letterSpacing: 1,
          }}>JR</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#FFF", fontFamily: "'Playfair Display',serif", letterSpacing: 0.3, lineHeight: 1 }}>Monetization</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 2, fontFamily: "'DM Mono',monospace" }}>ANALYTICS SUITE</div>
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ position: "relative" }}>
          <div style={{ width: 40, height: 2, background: PALETTE.teal, borderRadius: 1, marginBottom: 28 }} />
          <h1 style={{
            fontSize: 42, fontWeight: 700, color: "#FFF",
            fontFamily: "'Playfair Display',serif", lineHeight: 1.15,
            letterSpacing: -1, marginBottom: 20,
          }}>
            Your game's<br />revenue,<br />
            <span style={{ color: PALETTE.teal }}>at a glance.</span>
          </h1>
          <p style={{
            fontSize: 13, color: "rgba(255,255,255,0.5)",
            fontFamily: "'DM Mono',monospace", lineHeight: 1.7, maxWidth: 340,
          }}>
            Real-time analytics for game monetization — track revenue, conversion, product rankings, and how you stack up against peers.
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32 }}>
            {["Revenue Metrics", "Conversion Funnel", "Product Rankings", "Competitive Rank", "Platform Admin"].map((f) => (
              <span key={f} style={{
                fontSize: 10, padding: "5px 12px", borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'DM Mono',monospace", letterSpacing: 0.5,
              }}>{f}</span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono',monospace", letterSpacing: 1.5, position: "relative" }}>
          CONFIDENTIAL · FOR AUTHORIZED TENANTS ONLY
        </div>
      </div>

      {/* ── Right: login form ── */}
      <div style={{
        background: PALETTE.surface,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 72px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Heading */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontSize: 26, fontWeight: 700, color: PALETTE.navy,
              fontFamily: "'Playfair Display',serif", letterSpacing: -0.5, marginBottom: 8,
            }}>Sign in to your dashboard</h2>
            <p style={{ fontSize: 12, color: PALETTE.light, fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>
              Enter the API key for your tenant to access your game's analytics.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{
                display: "block", fontSize: 10, letterSpacing: 1.5,
                textTransform: "uppercase", color: PALETTE.mid,
                fontFamily: "'DM Mono',monospace", marginBottom: 8,
              }}>
                Tenant API Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  ref={inputRef}
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setError(""); }}
                  placeholder="tk_live_••••••••••••••••"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    width: "100%",
                    padding: "13px 56px 13px 16px",
                    border: `1px solid ${error ? "#FECACA" : PALETTE.border}`,
                    borderRadius: 8,
                    background: error ? "#FEF2F2" : PALETTE.surface,
                    fontSize: 13,
                    fontFamily: "'DM Mono',monospace",
                    color: PALETTE.navy,
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    letterSpacing: show ? 0 : 2,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = PALETTE.teal; e.target.style.boxShadow = `0 0 0 3px ${PALETTE.teal}20`; }}
                  onBlur={(e)  => { e.target.style.borderColor = error ? "#FECACA" : PALETTE.border; e.target.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 10, color: PALETTE.light, fontFamily: "'DM Mono',monospace",
                    letterSpacing: 1, padding: 0,
                  }}
                >{show ? "HIDE" : "SHOW"}</button>
              </div>
              {error && (
                <p style={{ marginTop: 8, fontSize: 11, color: "#DC2626", fontFamily: "'DM Mono',monospace", lineHeight: 1.5 }}>
                  {error}
                </p>
              )}
            </div>

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "14px",
                background: canSubmit ? PALETTE.teal : PALETTE.border,
                border: "none", borderRadius: 8,
                color: canSubmit ? "#FFF" : PALETTE.light,
                fontSize: 12, fontFamily: "'DM Mono',monospace",
                fontWeight: 600, letterSpacing: 1.5,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
              onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = "#0A5F63"; }}
              onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = PALETTE.teal; }}
            >
              {loading ? <><Spinner />VERIFYING KEY…</> : "ACCESS DASHBOARD →"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0" }}>
            <div style={{ flex: 1, height: 1, background: PALETTE.border }} />
            <span style={{ fontSize: 10, color: PALETTE.light, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: PALETTE.border }} />
          </div>

          {/* Admin shortcut */}
          <button
            type="button"
            onClick={() => onLogin(null)}
            style={{
              width: "100%", padding: "13px",
              background: "transparent",
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 8, color: PALETTE.indigo,
              fontSize: 12, fontFamily: "'DM Mono',monospace",
              fontWeight: 600, letterSpacing: 1.2, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${PALETTE.indigo}0A`; e.currentTarget.style.borderColor = PALETTE.indigo; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = PALETTE.border; }}
          >
            CONTINUE AS PLATFORM ADMIN →
          </button>

          <p style={{
            marginTop: 28, fontSize: 10, color: PALETTE.light,
            fontFamily: "'DM Mono',monospace", textAlign: "center", lineHeight: 1.8,
          }}>
            Your key is never stored or sent anywhere except<br />your own API. It lives in memory for this session only.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── TENANT DASHBOARD ─────────────────────────────────────────────────────────
function TenantDashboard({ tenantFetch }) {
  const accent = PALETTE.teal;
  const [overview,    setOverview]    = useState(null);
  const [timeseries,  setTimeseries]  = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      tenantFetch("/summary"),
      tenantFetch("/revenue-timeseries"),
      tenantFetch("/top-products"),
    ]).then(([ov, ts, tp]) => {
      if (ov.status === "fulfilled") setOverview(ov.value);
      else setErrors(e => ({ ...e, overview: ov.reason?.message }));
      if (ts.status === "fulfilled") setTimeseries(ts.value);
      else setErrors(e => ({ ...e, timeseries: ts.reason?.message }));
      if (tp.status === "fulfilled") setTopProducts(tp.value);
      else setErrors(e => ({ ...e, topProducts: tp.reason?.message }));
      setLoading(false);
    });
  }, [tenantFetch]);

  const chartData = (timeseries ?? []).map(row => ({
    date: row.date?.length === 10
      ? new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
      : row.date,
    revenue: row.revenue ?? 0,
  }));

  const conv = overview ? pct(overview.paid, overview.orders) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionHeader accent={accent} description="Period performance summary">Revenue Metrics</SectionHeader>
        {errors.overview && <ErrorBanner msg={errors.overview} />}
        {loading && !overview
          ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>{[...Array(4)].map((_,i) => <Skeleton key={i} h={120} />)}</div>
          : overview
            ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                <KpiCard label="Total Revenue"  value={fmt(overview.revenue)}  sub="This period"   accent={accent}          icon="$" />
                <KpiCard label="Total Orders"   value={overview.orders ?? "—"} sub="All attempts"  accent={PALETTE.indigo}  icon="▦" />
                <KpiCard label="Paid Orders"    value={overview.paid ?? "—"}   sub="Successful"    accent={PALETTE.gold}    icon="✓" />
                <KpiCard label="Conversion"     value={conv} sub={`${overview.paid ?? 0} of ${overview.orders ?? 0}`} accent={PALETTE.rose} icon="%" />
              </div>
            : !errors.overview && <Empty msg="Overview data unavailable." />
        }
      </div>

      <div>
        <SectionHeader accent={accent} description="Daily revenue trend">Revenue Timeline</SectionHeader>
        {errors.timeseries && <ErrorBanner msg={errors.timeseries} />}
        {loading && !timeseries ? <Skeleton h={260} />
          : chartData.length === 0 ? <Empty msg="No revenue timeseries data yet." />
          : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={accent} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={PALETTE.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: PALETTE.light, fontSize: 10, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fill: PALETTE.light, fontSize: 10, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<ChartTooltipUI />} />
                  <Area type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2.5} fill="url(#tGrad)" dot={false} activeDot={{ r: 5, fill: accent, stroke: PALETTE.surface, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )
        }
      </div>

      <div>
        <SectionHeader accent={accent} description="Highest earning SKUs by revenue">Top Products</SectionHeader>
        {errors.topProducts && <ErrorBanner msg={errors.topProducts} />}
        {loading && !topProducts ? <Skeleton h={240} />
          : !topProducts?.length ? <Empty msg="No product sales data yet." />
          : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <ChartCard>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topProducts} layout="vertical" barSize={12}>
                    <XAxis type="number" tickFormatter={fmtAxis} tick={{ fill: PALETTE.light, fontSize: 10, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="sku" tick={{ fill: PALETTE.slate, fontSize: 11, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<ChartTooltipUI />} />
                    <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
                      {topProducts.map((_, i) => <Cell key={i} fill={ACCENT_COLORS[i % ACCENT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <div style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: PALETTE.bg, borderBottom: `1px solid ${PALETTE.border}` }}>
                      {["#", "SKU", "Revenue", "Sales"].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: PALETTE.light, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.sku} style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
                        <td style={{ padding: "12px 16px", color: ACCENT_COLORS[i % ACCENT_COLORS.length], fontWeight: 700, fontSize: 13, fontFamily: "'Playfair Display',serif" }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", color: PALETTE.slate, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{p.sku}</td>
                        <td style={{ padding: "12px 16px", color: PALETTE.navy, fontSize: 13, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{fmt(p.revenue)}</td>
                        <td style={{ padding: "12px 16px", color: PALETTE.light, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{p.sales}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      </div>

      {overview && (
        <div>
          <SectionHeader accent={accent} description="Order conversion breakdown">Payment Funnel</SectionHeader>
          <div style={{
            background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: 8,
            padding: "24px 32px", display: "flex", alignItems: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            {[
              { label: "Initiated", val: overview.orders, color: PALETTE.light },
              { label: "Paid",      val: overview.paid,   color: accent },
              { label: "Failed",    val: (overview.orders ?? 0) - (overview.paid ?? 0), color: PALETTE.rose },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ flex: "0 0 32px", textAlign: "center", color: PALETTE.border, fontSize: 20 }}>›</div>}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    border: `2px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 700, color: s.color,
                    fontFamily: "'Playfair Display',serif", background: `${s.color}0D`,
                  }}>{s.val ?? "—"}</div>
                  <span style={{ fontSize: 10, color: PALETTE.light, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>{s.label}</span>
                  <div style={{ height: 2, width: "50%", background: s.color, borderRadius: 1, opacity: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const accent = PALETTE.indigo;
  const [overview,    setOverview]    = useState(null);
  const [timeseries,  setTimeseries]  = useState(null);
  const [topTenants,  setTopTenants]  = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      adminFetch("/overview"),
      adminFetch("/revenue-timeseries"),
      adminFetch("/top-tenants"),
      adminFetch("/top-products"),
    ]).then(([ov, ts, tt, tp]) => {
      if (ov.status === "fulfilled") setOverview(ov.value);
      else setErrors(e => ({ ...e, overview: ov.reason?.message }));
      if (ts.status === "fulfilled") setTimeseries(ts.value);
      else setErrors(e => ({ ...e, timeseries: ts.reason?.message }));
      if (tt.status === "fulfilled") setTopTenants(tt.value);
      else setErrors(e => ({ ...e, topTenants: tt.reason?.message }));
      if (tp.status === "fulfilled") setTopProducts(tp.value);
      else setErrors(e => ({ ...e, topProducts: tp.reason?.message }));
      setLoading(false);
    });
  }, []);

  const chartData = (timeseries ?? []).map(row => ({
    date: row.date?.length === 10
      ? new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
      : row.date,
    revenue: row.revenue ?? 0,
  }));

  const ranked = (topTenants ?? []).map((t, i) => ({ ...t, rank: i + 1 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionHeader accent={accent} description="Platform-wide performance across all tenants">Platform Overview</SectionHeader>
        {errors.overview && <ErrorBanner msg={errors.overview} />}
        {loading && !overview
          ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>{[...Array(4)].map((_,i) => <Skeleton key={i} h={120} />)}</div>
          : overview
            ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                <KpiCard label="Platform Revenue" value={fmt(overview.revenue)}       sub="All tenants"   accent={accent}         icon="$" />
                <KpiCard label="Total Orders"      value={overview.orders ?? "—"}     sub="Platform-wide" accent={PALETTE.teal}   icon="▦" />
                <KpiCard label="Paid Orders"       value={overview.paidOrders ?? "—"} sub="Converted"     accent={PALETTE.gold}   icon="✓" />
                <KpiCard label="Active Tenants"    value={overview.tenants ?? "—"}    sub="Live games"    accent={PALETTE.rose}   icon="≡" />
              </div>
            : !errors.overview && <Empty msg="Overview data unavailable." />
        }
      </div>

      <div>
        <SectionHeader accent={accent} description="Aggregate daily revenue across all tenants">Platform Revenue Timeline</SectionHeader>
        {errors.timeseries && <ErrorBanner msg={errors.timeseries} />}
        {loading && !timeseries ? <Skeleton h={260} />
          : chartData.length === 0 ? <Empty msg="No timeseries data yet." />
          : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={accent} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={PALETTE.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: PALETTE.light, fontSize: 10, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fill: PALETTE.light, fontSize: 10, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip content={<ChartTooltipUI />} />
                  <Area type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2.5} fill="url(#aGrad)" dot={false} activeDot={{ r: 5, fill: accent, stroke: PALETTE.surface, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )
        }
      </div>

      <div>
        <SectionHeader accent={accent} description="Revenue contribution ranked by tenant">Top Tenants — Leaderboard</SectionHeader>
        {errors.topTenants && <ErrorBanner msg={errors.topTenants} />}
        {loading && !topTenants ? <Skeleton h={240} />
          : !ranked.length ? <Empty msg="No tenant data yet." />
          : (
            <div style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: PALETTE.bg, borderBottom: `1px solid ${PALETTE.border}` }}>
                    {["Rank", "Tenant ID", "Revenue", "Orders", "Platform Share"].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: PALETTE.light, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((t, i) => {
                    const share = pct(t.revenue, overview?.revenue);
                    const barW  = ranked[0]?.revenue ? ((t.revenue / ranked[0].revenue) * 100).toFixed(1) : 0;
                    return (
                      <tr key={t.tenantName ?? i} style={{ borderBottom: `1px solid ${PALETTE.border}`, transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = PALETTE.bg}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 26, height: 26, borderRadius: "50%",
                            border: `1.5px solid ${RANK_COLORS[i] ?? PALETTE.border}`,
                            color: RANK_COLORS[i] ?? PALETTE.light,
                            fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                          }}>{t.rank}</span>
                        </td>
                        <td style={{ padding: "14px 18px", color: PALETTE.slate, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{t.tenantId}</td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ color: PALETTE.navy, fontWeight: 700, fontSize: 15, fontFamily: "'Playfair Display',serif" }}>{fmt(t.revenue)}</span>
                          <div style={{ marginTop: 5, height: 2, width: `${barW}%`, background: `linear-gradient(90deg,${accent},${accent}55)`, borderRadius: 1 }} />
                        </td>
                        <td style={{ padding: "14px 18px", color: PALETTE.light, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{t.orders}</td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            fontSize: 11, padding: "3px 9px", borderRadius: 12,
                            background: `${accent}12`, color: accent,
                            fontFamily: "'DM Mono',monospace", fontWeight: 600,
                          }}>{share}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      <div>
        <SectionHeader accent={accent} description="Highest earning SKUs across the platform">Global Top Products</SectionHeader>
        {errors.topProducts && <ErrorBanner msg={errors.topProducts} />}
        {loading && !topProducts ? <Skeleton h={260} />
          : !topProducts?.length ? <Empty msg="No product data yet." />
          : (
            <ChartCard>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={topProducts} barSize={32} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={PALETTE.border} vertical={false} />
                  <XAxis dataKey="sku" tick={{ fill: PALETTE.mid, fontSize: 11, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fill: PALETTE.light, fontSize: 10, fontFamily: "'DM Mono',monospace" }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip content={<ChartTooltipUI />} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {topProducts.map((_, i) => <Cell key={i} fill={ACCENT_COLORS[i % ACCENT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )
        }
      </div>
    </div>
  );
}

// ─── TENANT RANK VIEW ─────────────────────────────────────────────────────────
function TenantRankView({ tenantFetch }) {
  const accent = PALETTE.gold;
  const [tenants,  setTenants]  = useState(null);
  const [overview, setOverview] = useState(null);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      adminFetch("/top-tenants"),
      tenantFetch("/overview"),
    ]).then(([tt, ov]) => {
      if (tt.status === "fulfilled") setTenants(tt.value);
      else setErrors(e => ({ ...e, tenants: tt.reason?.message }));
      if (ov.status === "fulfilled") setOverview(ov.value);
      else setErrors(e => ({ ...e, overview: ov.reason?.message }));
      setLoading(false);
    });
  }, [tenantFetch]);

  const ranked  = (tenants ?? []).map((t, i) => ({ ...t, rank: i + 1 }));
  const myIdx   = ranked.findIndex(t => t.revenue === overview?.revenue);
  const safeIdx = myIdx >= 0 ? myIdx : 0;
  const me      = ranked[safeIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <SectionHeader accent={accent} description="Your performance relative to all active tenants">Competitive Rank</SectionHeader>
      {(errors.tenants || errors.overview) && <ErrorBanner msg={errors.tenants || errors.overview} />}

      {loading ? <Skeleton h={150} />
        : me
          ? (
            <div style={{
              background: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
              borderLeft: `4px solid ${accent}`, borderRadius: 8,
              padding: "28px 32px", display: "flex", alignItems: "center", gap: 36,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            }}>
              <div style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 64, lineHeight: 1, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: RANK_COLORS[safeIdx] ?? PALETTE.slate, letterSpacing: -2 }}>#{me.rank}</div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: PALETTE.light, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>YOUR RANK</div>
              </div>
              <div style={{ width: 1, height: 60, background: PALETTE.border }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: PALETTE.navy, fontFamily: "'Playfair Display',serif", marginBottom: 10 }}>{me.tenantId}</div>
                <div style={{ display: "flex", gap: 28 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: accent, fontFamily: "'Playfair Display',serif" }}>{fmt(me.revenue)}</div>
                    <div style={{ fontSize: 9, color: PALETTE.light, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>Revenue</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: PALETTE.indigo, fontFamily: "'Playfair Display',serif" }}>{me.orders}</div>
                    <div style={{ fontSize: 9, color: PALETTE.light, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>Orders</div>
                  </div>
                </div>
              </div>
              {ranked[0] && me.rank > 1 && (
                <div style={{ background: "#FEF2F2", border: `1px solid #FECACA`, borderRadius: 8, padding: "16px 20px", textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: PALETTE.light, fontFamily: "'DM Mono',monospace", marginBottom: 4, letterSpacing: 1 }}>VS LEADER</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#991B1B", fontFamily: "'Playfair Display',serif" }}>-{pct(ranked[0].revenue - me.revenue, ranked[0].revenue)}</div>
                  <div style={{ fontSize: 10, color: "#DC2626", fontFamily: "'DM Mono',monospace" }}>{fmt(ranked[0].revenue - me.revenue)} gap</div>
                </div>
              )}
            </div>
          )
          : !errors.tenants && <Empty msg="Could not determine your rank." />
      }

      {loading ? <Skeleton h={300} />
        : !ranked.length ? <Empty msg="No leaderboard data available." />
        : (
          <div style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            {ranked.map((t, i) => {
              const isMe = i === safeIdx;
              const barW = ranked[0]?.revenue ? ((t.revenue / ranked[0].revenue) * 100).toFixed(1) : 0;
              return (
                <div key={t.tenantId ?? i} style={{
                  padding: "14px 20px",
                  borderBottom: i < ranked.length - 1 ? `1px solid ${PALETTE.border}` : "none",
                  background: isMe ? `${accent}08` : "transparent",
                  borderLeft: isMe ? `3px solid ${accent}` : "3px solid transparent",
                  display: "flex", alignItems: "center", gap: 16, transition: "background 0.15s",
                }}
                  onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = PALETTE.bg; }}
                  onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: RANK_COLORS[i] ?? PALETTE.light, fontFamily: "'Playfair Display',serif" }}>#{t.rank}</span>
                  <span style={{ flex: "0 0 160px", fontSize: 12, color: isMe ? PALETTE.navy : PALETTE.slate, fontFamily: "'DM Mono',monospace", fontWeight: isMe ? 700 : 400 }}>
                    {t.tenantId}
                    {isMe && <span style={{ marginLeft: 8, fontSize: 8, background: accent, color: "#FFF", borderRadius: 3, padding: "2px 5px", letterSpacing: 1.5 }}>YOU</span>}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 4, borderRadius: 2, background: PALETTE.bg, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barW}%`, background: isMe ? accent : (RANK_COLORS[i] ?? PALETTE.light), borderRadius: 2, opacity: isMe ? 1 : 0.6 }} />
                    </div>
                  </div>
                  <span style={{ width: 80, textAlign: "right", fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? accent : PALETTE.light, fontFamily: "'DM Mono',monospace" }}>{fmt(t.revenue)}</span>
                </div>
              );
            })}
          </div>
        )
      }

      <div style={{ fontSize: 10, color: PALETTE.light, textAlign: "center", fontFamily: "'DM Mono',monospace", letterSpacing: 1.5 }}>
        COMPETITOR NAMES ARE ANONYMIZED · RANK REFRESHES EVERY 24H
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
// tenantKey state meanings:
//   null   → show login screen (initial)
//   false  → admin bypass (no tenant key — uses env ADMIN_API_KEY)
//   string → authenticated tenant (key entered at login)
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

  // Build a tenantFetch bound to the active key
  const activeTenantFetch = makeTenantFetch(
    typeof tenantKey === "string" ? tenantKey : ADMIN_API_KEY
  );

  function handleLogin(key) {
    if (key === null) {
      // Admin bypass
      setTenantKey(false);
      setMode("admin");
    } else {
      setTenantKey(key);
      setMode("tenant");
    }
  }

  function handleSignOut() {
    setTenantKey(null);
    setMode("tenant");
  }

  // ── Login screen ──
  if (tenantKey === null) {
    return (
      <>
        <GlobalStyles />
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  const isAdminOnly = tenantKey === false;

  const tabs = [
    ...(!isAdminOnly ? [
      { id: "tenant", label: "Game Dashboard", accent: PALETTE.teal },
      { id: "rank",   label: "My Rank",        accent: PALETTE.gold },
    ] : []),
    { id: "admin", label: "Admin Platform", accent: PALETTE.indigo },
  ];

  const currentAccent = tabs.find(t => t.id === mode)?.accent ?? PALETTE.teal;

  // Mask key for display: show first 8 chars then ••••
  const maskedKey = typeof tenantKey === "string"
    ? `${tenantKey.slice(0, 8)}••••`
    : "Admin";

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", background: PALETTE.bg }}>

        {/* Header */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${PALETTE.border}`,
          padding: "0 40px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 6, background: currentAccent,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#FFF",
                fontFamily: "'DM Mono',monospace", letterSpacing: 1, transition: "background 0.4s",
              }}>JR</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: PALETTE.navy, fontFamily: "'Playfair Display',serif", letterSpacing: 0.3, lineHeight: 1 }}>Monetization</div>
                <div style={{ fontSize: 9, color: PALETTE.light, letterSpacing: 2, fontFamily: "'DM Mono',monospace" }}>ANALYTICS SUITE</div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ display: "flex", gap: 2, background: PALETTE.bg, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 3 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setMode(t.id)} style={{
                  padding: "7px 20px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: mode === t.id ? PALETTE.surface : "transparent",
                  color: mode === t.id ? t.accent : PALETTE.light,
                  fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: mode === t.id ? 600 : 400,
                  boxShadow: mode === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  borderBottom: mode === t.id ? `2px solid ${t.accent}` : "2px solid transparent",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}>{t.label}</button>
              ))}
            </nav>

            {/* Right: key chip + live + sign out */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Active key indicator */}
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                background: PALETTE.bg, border: `1px solid ${PALETTE.border}`,
                borderRadius: 20, padding: "4px 12px",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: currentAccent }} />
                <span style={{ fontSize: 10, color: PALETTE.slate, fontFamily: "'DM Mono',monospace", letterSpacing: 0.5 }}>
                  {maskedKey}
                </span>
              </div>

              {/* Live clock */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 20, padding: "4px 12px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                <span style={{ fontSize: 10, color: "#065F46", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>LIVE</span>
              </div>
              <span style={{ fontSize: 11, color: PALETTE.light, fontFamily: "'DM Mono',monospace" }}>{time}</span>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                style={{
                  padding: "5px 12px", borderRadius: 6,
                  border: `1px solid ${PALETTE.border}`,
                  background: "transparent", color: PALETTE.light,
                  fontSize: 10, fontFamily: "'DM Mono',monospace",
                  cursor: "pointer", letterSpacing: 1, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = PALETTE.rose; e.currentTarget.style.borderColor = PALETTE.rose; }}
                onMouseLeave={e => { e.currentTarget.style.color = PALETTE.light; e.currentTarget.style.borderColor = PALETTE.border; }}
              >SIGN OUT</button>
            </div>
          </div>
        </header>

        {/* Page title bar */}
        <div style={{ background: PALETTE.surface, borderBottom: `1px solid ${PALETTE.border}`, padding: "16px 40px" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: PALETTE.navy, fontFamily: "'Playfair Display',serif", letterSpacing: -0.5, marginBottom: 2 }}>
                {mode === "tenant" ? "Game Developer Dashboard" : mode === "admin" ? "Platform Administration" : "Competitive Rankings"}
              </h1>
              <p style={{ fontSize: 11, color: PALETTE.light, fontFamily: "'DM Mono',monospace" }}>
                {mode === "tenant" ? "Your game's monetization performance" : mode === "admin" ? "Cross-tenant analytics and platform health" : "How your game ranks among peers"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["7D", "30D", "90D", "ALL"].map(r => (
                <button key={r} style={{
                  padding: "5px 12px", borderRadius: 5, border: `1px solid ${PALETTE.border}`,
                  background: r === "30D" ? currentAccent : PALETTE.surface,
                  color: r === "30D" ? "#FFF" : PALETTE.light,
                  fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer",
                  fontWeight: r === "30D" ? 600 : 400, transition: "all 0.15s",
                }}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 40px 60px" }}>
          {mode === "tenant" && !isAdminOnly && <TenantDashboard tenantFetch={activeTenantFetch} />}
          {mode === "admin"  && <AdminDashboard />}
          {mode === "rank"   && !isAdminOnly && <TenantRankView tenantFetch={activeTenantFetch} />}
        </main>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${PALETTE.border}`, padding: "16px 40px", background: PALETTE.surface }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: PALETTE.light, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>MONETIZATION ANALYTICS · CONFIDENTIAL</span>
            <span style={{ fontSize: 10, color: PALETTE.light, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>DATA REFRESHES EVERY 24H</span>
          </div>
        </footer>
      </div>
    </>
  );
}