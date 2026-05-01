import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PROPERTY_TYPES } from "@shared/schema";
import { FileText, Search, Download, Loader2, Building2, TrendingUp, Clock, Wrench } from "lucide-react";

type Comp = {
  id: number;
  propertyName: string;
  propertyAddress: string;
  city: string;
  state: string;
  propertyType: string;
  propertyClass: string;
  tenantName: string;
  landlordName?: string;
  leasedSF: number;
  leaseType?: string;
  baseRent: number;
  effectiveRent?: number;
  leaseTermMonths: number;
  leaseStartDate?: string;
  leaseEndDate?: string;
  tiAllowance?: number;
  freeRentMonths?: number;
  landlordWork?: string;
  escalationRate?: number;
  suiteNumber?: string;
  notes?: string;
  submittedBy?: string;
  submittedAt: string;
};

function fmtSF(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString() + " SF";
}
function fmtRent(n?: number | null) {
  if (n == null) return "—";
  return "$" + n.toFixed(2) + "/SF";
}
function fmtMonths(n?: number | null) {
  if (n == null) return "—";
  const yrs = Math.floor(n / 12);
  const mos = n % 12;
  if (yrs === 0) return `${mos}mo`;
  if (mos === 0) return `${yrs}yr`;
  return `${yrs}yr ${mos}mo`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }); } catch { return d; }
}
function avg(arr: number[]) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export default function CompReport() {
  const [propertyType, setPropertyType] = useState("All");
  const [minSF, setMinSF] = useState("");
  const [maxSF, setMaxSF] = useState("");
  const [searched, setSearched] = useState(false);

  const params = new URLSearchParams();
  if (propertyType !== "All") params.set("propertyType", propertyType);
  if (minSF) params.set("minSF", minSF);
  if (maxSF) params.set("maxSF", maxSF);
  const queryString = params.toString();

  const { data: comps = [], isFetching, refetch } = useQuery<Comp[]>({
    queryKey: ["/api/comps/search", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/comps/search${queryString ? "?" + queryString : ""}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searched,
  });

  function handleSearch() {
    setSearched(true);
    refetch();
  }

  // Summary stats
  const rents = comps.map(c => c.baseRent).filter(Boolean);
  const sfs = comps.map(c => c.leasedSF).filter(Boolean);
  const terms = comps.map(c => c.leaseTermMonths).filter(Boolean);
  const tis = comps.map(c => c.tiAllowance).filter((v): v is number => v != null && v > 0);
  const avgRent = avg(rents);
  const avgSF = avg(sfs);
  const avgTerm = avg(terms);
  const avgTI = avg(tis);

  function generatePDF() {
    const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const filterDesc = [
      propertyType !== "All" ? `Type: ${propertyType}` : null,
      minSF ? `Min SF: ${Number(minSF).toLocaleString()}` : null,
      maxSF ? `Max SF: ${Number(maxSF).toLocaleString()}` : null,
    ].filter(Boolean).join(" · ") || "All Properties";

    const statsHtml = `
      <div class="stats-grid">
        ${avgRent != null ? `<div class="stat"><div class="stat-label">Avg Base Rent</div><div class="stat-value">$${avgRent.toFixed(2)}/SF</div></div>` : ""}
        ${avgSF != null ? `<div class="stat"><div class="stat-label">Avg Deal Size</div><div class="stat-value">${Math.round(avgSF).toLocaleString()} SF</div></div>` : ""}
        ${avgTerm != null ? `<div class="stat"><div class="stat-label">Avg Lease Term</div><div class="stat-value">${fmtMonths(Math.round(avgTerm))}</div></div>` : ""}
        ${avgTI != null ? `<div class="stat"><div class="stat-label">Avg TI Allowance</div><div class="stat-value">$${avgTI.toFixed(2)}/SF</div></div>` : ""}
      </div>
    `;

    const rows = comps.map(c => `
      <tr>
        <td><strong>${c.propertyName}</strong><br><small>${c.city}, ${c.state}</small></td>
        <td>${c.propertyType}<br><small class="badge">${c.propertyClass}</small></td>
        <td>${c.tenantName}</td>
        <td>${fmtSF(c.leasedSF)}</td>
        <td>${fmtRent(c.baseRent)}</td>
        <td>${c.leaseType || "—"}</td>
        <td>${fmtMonths(c.leaseTermMonths)}</td>
        <td>${c.tiAllowance != null ? "$" + c.tiAllowance.toFixed(2) + "/SF" : "—"}</td>
        <td>${fmtDate(c.leaseStartDate)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>GMRE Comp Report — ${now}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a2e; padding: 32px; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; border-bottom: 3px solid #1a3a5c; padding-bottom: 16px; }
  .header-text h1 { font-size: 18px; font-weight: 700; color: #1a3a5c; }
  .header-text p { font-size: 11px; color: #64748b; margin-top: 2px; }
  .filters { background: #f0f4f8; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 10px; color: #475569; }
  .filters strong { color: #1a3a5c; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #1a3a5c; color: white; border-radius: 6px; padding: 12px; }
  .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; margin-bottom: 4px; }
  .stat-value { font-size: 15px; font-weight: 700; }
  h2 { font-size: 12px; font-weight: 600; color: #1a3a5c; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  thead th { background: #1a3a5c; color: white; padding: 7px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; line-height: 1.4; }
  tbody td strong { color: #1a3a5c; }
  small { color: #64748b; font-size: 8.5px; }
  .badge { background: #e2e8f0; color: #475569; border-radius: 3px; padding: 1px 4px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-text">
      <h1>Grant Murray Real Estate — Comp Report</h1>
      <p>Generated ${now} · ${comps.length} comp${comps.length !== 1 ? "s" : ""} · ${filterDesc}</p>
    </div>
  </div>
  <div class="filters"><strong>Filters applied:</strong> ${filterDesc}</div>
  ${statsHtml}
  <h2>Lease Comps Detail</h2>
  <table>
    <thead>
      <tr>
        <th>Property</th><th>Type / Class</th><th>Tenant</th><th>Size</th>
        <th>Base Rent</th><th>Lease Type</th><th>Term</th><th>TI/SF</th><th>Start</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Grant Murray Real Estate · Fayetteville, NC · CCIM · SIOR</span>
    <span>Confidential — for internal use only</span>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      setTimeout(() => { win.print(); }, 600);
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold font-display">Comp Report</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Search the database by property type and size range, then export a PDF report.
          </p>
        </div>

        {/* Search filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Property Type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Min Size (SF)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 1,000"
                  value={minSF}
                  onChange={e => setMinSF(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Size (SF)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50,000"
                  value={maxSF}
                  onChange={e => setMaxSF(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleSearch} disabled={isFetching} className="gap-2">
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isFetching ? "Searching..." : "Search Comps"}
              </Button>
              {searched && !isFetching && (
                <span className="text-sm text-muted-foreground">
                  {comps.length} comp{comps.length !== 1 ? "s" : ""} found
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && !isFetching && comps.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {avgRent != null && (
                <Card className="bg-primary text-primary-foreground">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-1.5 mb-1 opacity-80">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Avg Base Rent</span>
                    </div>
                    <div className="text-xl font-bold">${avgRent.toFixed(2)}/SF</div>
                  </CardContent>
                </Card>
              )}
              {avgSF != null && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Avg Deal Size</span>
                    </div>
                    <div className="text-xl font-bold">{Math.round(avgSF).toLocaleString()} SF</div>
                  </CardContent>
                </Card>
              )}
              {avgTerm != null && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Avg Lease Term</span>
                    </div>
                    <div className="text-xl font-bold">{fmtMonths(Math.round(avgTerm))}</div>
                  </CardContent>
                </Card>
              )}
              {avgTI != null && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Avg TI</span>
                    </div>
                    <div className="text-xl font-bold">${avgTI.toFixed(2)}/SF</div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Export button */}
            <div className="flex justify-end">
              <Button variant="outline" className="gap-2" onClick={generatePDF}>
                <Download className="h-4 w-4" />
                Export PDF Report
              </Button>
            </div>

            {/* Comp table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Property</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Type</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Tenant</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Size</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Rent/SF</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Lease Type</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Term</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden md:table-cell">TI/SF</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden md:table-cell">Start</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comps.map((c, i) => (
                        <tr key={c.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{c.propertyName}</div>
                            <div className="text-xs text-muted-foreground">{c.city}, {c.state}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{c.propertyType}</div>
                            <Badge variant="secondary" className="text-[10px] mt-0.5">{c.propertyClass}</Badge>
                          </td>
                          <td className="px-4 py-3">{c.tenantName}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtSF(c.leasedSF)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtRent(c.baseRent)}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">{c.leaseType || "—"}</td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums">{fmtMonths(c.leaseTermMonths)}</td>
                          <td className="px-4 py-3 text-right hidden md:table-cell tabular-nums">
                            {c.tiAllowance != null ? `$${c.tiAllowance.toFixed(2)}/SF` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">{fmtDate(c.leaseStartDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {searched && !isFetching && comps.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No comps found</p>
              <p className="text-sm mt-1">Try adjusting your filters or broadening the size range.</p>
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}
