import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TrendingUp, Building2, Users, Clock, DollarSign, Ruler, Search,
  ArrowUpDown, ChevronDown, ChevronUp, Eye, X, Download
} from "lucide-react";
import type { LeaseComp } from "@shared/schema";
import { PROPERTY_TYPES } from "@shared/schema";

const TYPE_COLORS: Record<string, string> = {
  "Office": "badge-office",
  "Retail": "badge-retail",
  "Industrial": "badge-industrial",
  "Medical/Healthcare": "badge-medical",
  "Flex": "badge-flex",
  "Mixed-Use": "badge-mixed",
  "Land": "badge-land",
};

const CLASS_COLORS: Record<string, string> = {
  "Class A": "badge-class-a",
  "Class B": "badge-class-b",
  "Class C": "badge-class-c",
};

function fmt(n: number | null | undefined, prefix = "", suffix = "", decimals = 2) {
  if (n == null) return "—";
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}
function fmtSF(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} SF`;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" }); } catch { return s; }
}

type SortKey = keyof LeaseComp;
type SortDir = "asc" | "desc";

export default function Dashboard() {
  const [activeType, setActiveType] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedComp, setSelectedComp] = useState<LeaseComp | null>(null);

  const { data: comps = [], isLoading } = useQuery<LeaseComp[]>({
    queryKey: ["/api/comps"],
    queryFn: () => apiRequest("GET", "/api/comps").then(r => r.json()),
  });

  const filtered = useMemo(() => {
    let rows = [...comps];
    if (activeType !== "All") rows = rows.filter(c => c.propertyType === activeType);
    if (classFilter !== "All") rows = rows.filter(c => c.propertyClass === classFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(c =>
        c.propertyName.toLowerCase().includes(q) ||
        c.tenantName.toLowerCase().includes(q) ||
        (c.landlordName || "").toLowerCase().includes(q) ||
        c.propertyAddress.toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortKey as string] ?? "";
      const vb = (b as Record<string, unknown>)[sortKey as string] ?? "";
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [comps, activeType, classFilter, search, sortKey, sortDir]);

  // ---- Analytics for active filter ----
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const rents = filtered.filter(c => c.baseRent != null).map(c => c.baseRent!);
    const avgRent = rents.length ? rents.reduce((a, b) => a + b, 0) / rents.length : null;
    const sizes = filtered.filter(c => c.leasedSF != null).map(c => c.leasedSF!);
    const avgSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null;
    const terms = filtered.filter(c => c.leaseTermMonths != null).map(c => c.leaseTermMonths!);
    const avgTerm = terms.length ? terms.reduce((a, b) => a + b, 0) / terms.length : null;
    const tiArr = filtered.filter(c => c.tiAllowance != null).map(c => c.tiAllowance!);
    const avgTI = tiArr.length ? tiArr.reduce((a, b) => a + b, 0) / tiArr.length : null;

    // Biggest tenant (by leasedSF)
    const byTenant: Record<string, number> = {};
    filtered.forEach(c => {
      if (c.tenantName && c.leasedSF) byTenant[c.tenantName] = (byTenant[c.tenantName] || 0) + c.leasedSF;
    });
    const topTenant = Object.entries(byTenant).sort((a, b) => b[1] - a[1])[0];

    const byLandlord: Record<string, number> = {};
    filtered.forEach(c => {
      if (c.landlordName && c.leasedSF) byLandlord[c.landlordName] = (byLandlord[c.landlordName] || 0) + c.leasedSF;
    });
    const topLandlord = Object.entries(byLandlord).sort((a, b) => b[1] - a[1])[0];

    return { avgRent, avgSize, avgTerm, avgTI, topTenant, topLandlord, count: filtered.length };
  }, [filtered]);

  // Per-type deal counts for tab badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: comps.length };
    PROPERTY_TYPES.forEach(t => { counts[t] = comps.filter(c => c.propertyType === t).length; });
    return counts;
  }, [comps]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
  }

  function downloadCSV() {
    const headers = ["Property","Address","City","Type","Class","Tenant","Landlord","SF Leased","Base Rent/SF","Lease Type","Term (Mo.)","TI/SF","Start","End","Submitted"];
    const rows = filtered.map(c => [
      c.propertyName, c.propertyAddress, c.city, c.propertyType, c.propertyClass,
      c.tenantName, c.landlordName || "", c.leasedSF, c.baseRent, c.leaseType || "",
      c.leaseTermMonths, c.tiAllowance || "", c.leaseStartDate || "", c.leaseEndDate || "",
      c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gmre-comps-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold font-display text-foreground">Market Comp Database</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {comps.length} lease {comps.length === 1 ? "comp" : "comps"} across {new Set(comps.map(c => c.propertyType)).size} property types
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2 self-start sm:self-auto" data-testid="btn-download-csv">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Property type tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by property type">
          {["All", ...PROPERTY_TYPES].map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={activeType === t}
              onClick={() => setActiveType(t)}
              data-testid={`tab-type-${t.toLowerCase().replace(/\W+/g, "-")}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeType === t
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {t}
              <span className={`ml-1.5 text-[10px] font-normal ${activeType === t ? "opacity-80" : "opacity-60"}`}>
                ({typeCounts[t] ?? 0})
              </span>
            </button>
          ))}
        </div>

        {/* Stats cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card data-testid="stat-avg-rent">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Avg. Base Rent</span>
                </div>
                <div className="text-lg font-bold font-display">{fmt(stats.avgRent, "$", "/SF", 2)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">per year</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-avg-size">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Ruler className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Avg. Deal Size</span>
                </div>
                <div className="text-lg font-bold font-display">{fmtSF(stats.avgSize)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">leased SF</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-avg-term">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Avg. Lease Term</span>
                </div>
                <div className="text-lg font-bold font-display">
                  {stats.avgTerm ? `${(stats.avgTerm / 12).toFixed(1)} yrs` : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stats.avgTerm ? `${Math.round(stats.avgTerm)} months` : ""}</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-avg-ti">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Avg. TI Allowance</span>
                </div>
                <div className="text-lg font-bold font-display">{fmt(stats.avgTI, "$", "/SF", 2)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">tenant improvement</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-top-tenant">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Top Tenant</span>
                </div>
                <div className="text-sm font-bold font-display truncate">{stats.topTenant?.[0] ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stats.topTenant ? fmtSF(stats.topTenant[1]) + " leased" : ""}</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-top-landlord">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Top Landlord</span>
                </div>
                <div className="text-sm font-bold font-display truncate">{stats.topLandlord?.[0] ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stats.topLandlord ? fmtSF(stats.topLandlord[1]) + " owned" : ""}</div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No comps yet. <a href="/#/submit" className="text-primary underline underline-offset-2">Submit the first one.</a>
            </CardContent>
          </Card>
        )}

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by property, tenant, landlord, or address..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-class-filter">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Classes</SelectItem>
              <SelectItem value="Class A">Class A</SelectItem>
              <SelectItem value="Class B">Class B</SelectItem>
              <SelectItem value="Class C">Class C</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 cursor-pointer select-none" onClick={() => toggleSort("propertyName")}>
                      <span className="flex items-center">Property <SortIcon k="propertyName" /></span>
                    </TableHead>
                    <TableHead>Type / Class</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tenantName")}>
                      <span className="flex items-center">Tenant <SortIcon k="tenantName" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("leasedSF")}>
                      <span className="flex items-center justify-end">SF <SortIcon k="leasedSF" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("baseRent")}>
                      <span className="flex items-center justify-end">Rent/SF <SortIcon k="baseRent" /></span>
                    </TableHead>
                    <TableHead>Lease Type</TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("leaseTermMonths")}>
                      <span className="flex items-center justify-end">Term <SortIcon k="leaseTermMonths" /></span>
                    </TableHead>
                    <TableHead className="text-right">TI/SF</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("leaseStartDate")}>
                      <span className="flex items-center">Start <SortIcon k="leaseStartDate" /></span>
                    </TableHead>
                    <TableHead className="pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 10 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                        {comps.length === 0
                          ? "No comps submitted yet. Be the first to add one."
                          : "No comps match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(comp => (
                      <TableRow
                        key={comp.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedComp(comp)}
                        data-testid={`row-comp-${comp.id}`}
                      >
                        <TableCell className="pl-4 font-medium max-w-[180px]">
                          <div className="truncate font-semibold text-sm">{comp.propertyName}</div>
                          <div className="text-xs text-muted-foreground truncate">{comp.propertyAddress}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${TYPE_COLORS[comp.propertyType] ?? "bg-muted text-muted-foreground"}`}>
                              {comp.propertyType}
                            </span>
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${CLASS_COLORS[comp.propertyClass] ?? "bg-muted text-muted-foreground"}`}>
                              {comp.propertyClass}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[140px]">
                          <div className="truncate">{comp.tenantName}</div>
                          {comp.landlordName && (
                            <div className="text-[11px] text-muted-foreground truncate">{comp.landlordName}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtSF(comp.leasedSF)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-semibold">{fmt(comp.baseRent, "$", "", 2)}</TableCell>
                        <TableCell className="text-sm">
                          <span className="text-xs text-muted-foreground">{comp.leaseType ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {comp.leaseTermMonths ? `${comp.leaseTermMonths} mo.` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {fmt(comp.tiAllowance, "$", "", 2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(comp.leaseStartDate)}</TableCell>
                        <TableCell className="pr-4">
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`btn-view-${comp.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Count */}
        {filtered.length > 0 && (
          <div className="text-xs text-muted-foreground text-right">
            Showing {filtered.length} of {comps.length} comps
          </div>
        )}
      </div>

      {/* Comp detail dialog */}
      <Dialog open={!!selectedComp} onOpenChange={open => !open && setSelectedComp(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-comp-detail">
          {selectedComp && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display pr-4">{selectedComp.propertyName}</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[selectedComp.propertyType] ?? "bg-muted text-muted-foreground"}`}>
                    {selectedComp.propertyType}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CLASS_COLORS[selectedComp.propertyClass] ?? "bg-muted text-muted-foreground"}`}>
                    {selectedComp.propertyClass}
                  </span>
                  {selectedComp.leaseType && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {selectedComp.leaseType}
                    </span>
                  )}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 mt-2">
                <DetailRow label="Address" value={`${selectedComp.propertyAddress}, ${selectedComp.city}, ${selectedComp.state}`} />
                {selectedComp.suiteNumber && <DetailRow label="Suite" value={selectedComp.suiteNumber} />}
                {selectedComp.buildingSize && <DetailRow label="Building Size" value={fmtSF(selectedComp.buildingSize)} />}
                {selectedComp.yearBuilt && <DetailRow label="Year Built" value={String(selectedComp.yearBuilt)} />}

                <div className="col-span-full my-3 border-t border-border" />
                <h3 className="col-span-full text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lease Details</h3>

                <DetailRow label="Tenant" value={selectedComp.tenantName} />
                {selectedComp.landlordName && <DetailRow label="Landlord" value={selectedComp.landlordName} />}
                <DetailRow label="Leased SF" value={fmtSF(selectedComp.leasedSF)} />
                <DetailRow label="Base Rent" value={fmt(selectedComp.baseRent, "$", "/SF/yr")} />
                {selectedComp.effectiveRent && <DetailRow label="Effective Rent" value={fmt(selectedComp.effectiveRent, "$", "/SF/yr")} />}
                <DetailRow label="Lease Term" value={selectedComp.leaseTermMonths ? `${selectedComp.leaseTermMonths} months (${(selectedComp.leaseTermMonths / 12).toFixed(1)} yrs)` : "—"} />
                {selectedComp.leaseStartDate && <DetailRow label="Start Date" value={fmtDate(selectedComp.leaseStartDate)} />}
                {selectedComp.leaseEndDate && <DetailRow label="End Date" value={fmtDate(selectedComp.leaseEndDate)} />}
                {selectedComp.escalationRate && <DetailRow label="Annual Escalation" value={fmt(selectedComp.escalationRate, "", "%", 2)} />}

                <div className="col-span-full my-3 border-t border-border" />
                <h3 className="col-span-full text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Concessions & Work</h3>

                <DetailRow label="TI Allowance" value={fmt(selectedComp.tiAllowance, "$", "/SF")} />
                {selectedComp.freeRentMonths != null && <DetailRow label="Free Rent" value={`${selectedComp.freeRentMonths} months`} />}
                {selectedComp.landlordWork && <DetailRow label="Landlord Work" value={selectedComp.landlordWork} wide />}

                {selectedComp.parkingRatio && (
                  <>
                    <div className="col-span-full my-3 border-t border-border" />
                    <DetailRow label="Parking Ratio" value={`${selectedComp.parkingRatio}/1,000 SF`} />
                  </>
                )}
                {selectedComp.notes && (
                  <>
                    <div className="col-span-full my-3 border-t border-border" />
                    <DetailRow label="Notes" value={selectedComp.notes} wide />
                  </>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex justify-between">
                <span>Submitted by {selectedComp.submittedBy || "anonymous"}</span>
                <span>{selectedComp.submittedAt ? new Date(selectedComp.submittedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : ""}</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function DetailRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`py-2 ${wide ? "col-span-full" : ""}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground mt-0.5">{value}</div>
    </div>
  );
}
