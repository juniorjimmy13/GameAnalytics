import { useState, useEffect } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area
} from "recharts";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TENANT_API_KEY = import.meta.env.VITE_TENANT_API_KEY;
const TENANT_BASE    = import.meta.env.VITE_TENANT_BASE;
const ADMIN_BASE     = import.meta.env.VITE_ADMIN_BASE;

const tenantFetch = (path) =>
  fetch(`${TENANT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TENANT_API_KEY}` },
  }).then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.url}`); return r.json(); });

const adminFetch = (path) =>
  fetch(`${ADMIN_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TENANT_API_KEY}` },
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

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = PALETTE.teal, icon, trend }) {
  return (
    <div style={{
      background: PALETTE.surface,
      border: `1px solid ${PALETTE.border}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 8,
      padding: "22px 24px 18px",
      display: "flex", flexDirection: "column", gap: 8,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      position: "relative",
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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {sub && <span style={{ fontSize: 11, color: accent, fontFamily: "'DM Mono',monospace" }}>{sub}</span>}
        {trend && (
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 12,
            background: trend > 0 ? "#ECFDF5" : "#FEF2F2",
            color: trend > 0 ? "#065F46" : "#991B1B",
            fontFamily: "'DM Mono',monospace", fontWeight: 700,
          }}>{trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>
        )}
      </div>
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

const ChartTooltip = ({ active, payload, label, accent }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: PALETTE.navy, border: "none", borderRadius: 6,
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

// ─── TENANT DASHBOARD ─────────────────────────────────────────────────────────
function TenantDashboard() {
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
  }, []);

  const chartData = (timeseries ?? []).map(row => ({
    date: row.date?.length === 10
      ? new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
      : row.date,
    revenue: row.revenue ?? 0,
  }));

  const conv = overview ? pct(overview.paid, overview.orders) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* KPI Row */}
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

      {/* Revenue Timeseries */}
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
                  <Tooltip content={<ChartTooltip accent={accent} />} />
                  <Area type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2.5} fill="url(#tGrad)" dot={false} activeDot={{ r: 5, fill: accent, stroke: PALETTE.surface, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )
        }
      </div>

      {/* Top Products */}
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
                    <Tooltip content={<ChartTooltip accent={accent} />} />
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

      {/* Payment Funnel */}
      {overview && (
        <div>
          <SectionHeader accent={accent} description="Order conversion breakdown">Payment Funnel</SectionHeader>
          <div style={{
            background: PALETTE.surface,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 8,
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            {[
              { label: "Initiated", val: overview.orders, color: PALETTE.light },
              { label: "Paid",      val: overview.paid,   color: accent },
              { label: "Failed",    val: (overview.orders ?? 0) - (overview.paid ?? 0), color: PALETTE.rose },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, display: "flex", alignItems: "center", gap: 0 }}>
                {i > 0 && (
                  <div style={{ flex: "0 0 32px", textAlign: "center", color: PALETTE.border, fontSize: 20 }}>›</div>
                )}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    border: `2px solid ${s.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 700, color: s.color,
                    fontFamily: "'Playfair Display',serif",
                    background: `${s.color}0D`,
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
                  <Tooltip content={<ChartTooltip accent={accent} />} />
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
                  <Tooltip content={<ChartTooltip accent={accent} />} />
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
function TenantRankView() {
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
  }, []);

  const ranked  = (tenants ?? []).map((t, i) => ({ ...t, rank: i + 1 }));
  const myIdx   = ranked.findIndex(t => t.revenue === overview?.revenue);
  const safeIdx = myIdx >= 0 ? myIdx : 0;
  const me      = ranked[safeIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <SectionHeader accent={accent} description="Your performance relative to all active tenants">Competitive Rank</SectionHeader>

      {(errors.tenants || errors.overview) && <ErrorBanner msg={errors.tenants || errors.overview} />}

      {/* Hero card */}
      {loading ? <Skeleton h={150} />
        : me
          ? (
            <div style={{
              background: PALETTE.surface,
              border: `1px solid ${PALETTE.border}`,
              borderLeft: `4px solid ${accent}`,
              borderRadius: 8,
              padding: "28px 32px",
              display: "flex", alignItems: "center", gap: 36,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            }}>
              <div style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{
                  fontSize: 64, lineHeight: 1,
                  fontFamily: "'Playfair Display',serif",
                  fontWeight: 700, color: RANK_COLORS[safeIdx] ?? PALETTE.slate,
                  letterSpacing: -2,
                }}>#{me.rank}</div>
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
                <div style={{
                  background: "#FEF2F2",
                  border: `1px solid #FECACA`,
                  borderRadius: 8,
                  padding: "16px 20px",
                  textAlign: "right",
                }}>
                  <div style={{ fontSize: 9, color: PALETTE.light, fontFamily: "'DM Mono',monospace", marginBottom: 4, letterSpacing: 1 }}>VS LEADER</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#991B1B", fontFamily: "'Playfair Display',serif" }}>-{pct(ranked[0].revenue - me.revenue, ranked[0].revenue)}</div>
                  <div style={{ fontSize: 10, color: "#DC2626", fontFamily: "'DM Mono',monospace" }}>{fmt(ranked[0].revenue - me.revenue)} gap</div>
                </div>
              )}
            </div>
          )
          : !errors.tenants && <Empty msg="Could not determine your rank." />
      }

      {/* Leaderboard */}
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
                  display: "flex", alignItems: "center", gap: 16,
                  transition: "background 0.15s",
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
export default function App() {
  const [mode, setMode] = useState("tenant");
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const tabs = [
    { id: "tenant", label: "Game Dashboard", accent: PALETTE.teal },
    { id: "rank",   label: "My Rank",        accent: PALETTE.gold },
    { id: "admin",  label: "Admin Platform", accent: PALETTE.indigo },
  ];
  const currentAccent = tabs.find(t => t.id === mode)?.accent ?? PALETTE.teal;

  return (
    <>
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
      `}</style>

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
                width: 30, height: 30, borderRadius: 6,
                background: currentAccent,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#FFF",
                fontFamily: "'DM Mono',monospace", letterSpacing: 1,
                transition: "background 0.4s",
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

            {/* Live indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 20, padding: "4px 12px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                <span style={{ fontSize: 10, color: "#065F46", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>LIVE</span>
              </div>
              <span style={{ fontSize: 11, color: PALETTE.light, fontFamily: "'DM Mono',monospace" }}>{time}</span>
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
        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 40px 60px", position: "relative" }}>
          {mode === "tenant" && <TenantDashboard />}
          {mode === "admin"  && <AdminDashboard  />}
          {mode === "rank"   && <TenantRankView  />}
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