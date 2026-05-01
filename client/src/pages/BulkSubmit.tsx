import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PROPERTY_TYPES, PROPERTY_CLASSES, LEASE_TYPES } from "@shared/schema";
import { z } from "zod";
import {
  PlusCircle, Trash2, Loader2, Lock, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Copy, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

// Single comp schema for bulk rows (no submitPassword per row)
const bulkCompRowSchema = z.object({
  tenantName: z.string().min(1, "Required"),
  landlordName: z.string().optional(),
  suiteNumber: z.string().optional(),
  leasedSF: z.coerce.number().positive("Required"),
  leaseType: z.string().optional(),
  baseRent: z.coerce.number().positive("Required"),
  effectiveRent: z.coerce.number().positive().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  leaseTermMonths: z.coerce.number().int().positive("Required"),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  tiAllowance: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  freeRentMonths: z.coerce.number().int().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  landlordWork: z.string().optional(),
  escalationRate: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  notes: z.string().optional(),
});

const bulkFormSchema = z.object({
  // Shared property fields (apply to all comps)
  submitPassword: z.string().min(1, "Password required"),
  submittedBy: z.string().optional(),
  propertyName: z.string().min(1, "Required"),
  propertyAddress: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zipCode: z.string().optional(),
  propertyType: z.string().min(1, "Required"),
  propertyClass: z.string().min(1, "Required"),
  buildingSize: z.coerce.number().positive().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  yearBuilt: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  parkingRatio: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  // Per-comp rows
  comps: z.array(bulkCompRowSchema).min(1, "Add at least one comp"),
});

type BulkFormValues = z.infer<typeof bulkFormSchema>;
type CompRow = z.infer<typeof bulkCompRowSchema>;

const EMPTY_ROW: CompRow = {
  tenantName: "", landlordName: "", suiteNumber: "",
  leasedSF: "" as unknown as number, leaseType: "",
  baseRent: "" as unknown as number, effectiveRent: "",
  leaseTermMonths: "" as unknown as number,
  leaseStartDate: "", leaseEndDate: "",
  tiAllowance: "", freeRentMonths: "",
  landlordWork: "", escalationRate: "", notes: "",
};

type SubmitResult = { succeeded: number; failed: number; results: { index: number; success: boolean; error?: string }[] };

export default function BulkSubmit() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]));
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const form = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      submitPassword: "", submittedBy: "",
      propertyName: "", propertyAddress: "", city: "Fayetteville", state: "NC", zipCode: "",
      propertyType: "", propertyClass: "",
      comps: [{ ...EMPTY_ROW }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "comps" });

  const toggleRow = (i: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const duplicateRow = (i: number) => {
    const row = form.getValues(`comps.${i}`);
    // Copy all but clear tenant/suite so user edits them
    append({ ...row, tenantName: "", suiteNumber: "" });
    setExpandedRows(prev => new Set([...prev, fields.length]));
  };

  const bulkMutation = useMutation({
    mutationFn: async (data: BulkFormValues) => {
      const { submitPassword, submittedBy, comps, ...sharedProperty } = data;
      // Merge shared property fields into every comp row
      const merged = comps.map(row => ({
        ...sharedProperty,
        ...row,
        submittedBy: submittedBy || undefined,
      }));
      const res = await apiRequest("POST", "/api/comps/bulk", { submitPassword, comps: merged });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk submission failed");
      }
      return res.json() as Promise<SubmitResult>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comps"] });
      setSubmitResult(result);
      toast({
        title: `${result.succeeded} comp${result.succeeded !== 1 ? "s" : ""} submitted`,
        description: result.failed > 0 ? `${result.failed} failed — check below.` : "All comps are now live.",
      });
      if (result.failed === 0) {
        setTimeout(() => navigate("/"), 1800);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: BulkFormValues) {
    setSubmitResult(null);
    bulkMutation.mutate(data);
  }

  const rowHasError = (i: number) => {
    const errs = form.formState.errors.comps?.[i];
    return errs && Object.keys(errs).length > 0;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold font-display">Bulk Comp Submission</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter shared property details once, then add as many lease comps as needed for that building.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Agent access */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 font-display">
                  <Lock className="h-4 w-4 text-primary" />
                  Agent Access
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="submitPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Password *</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Team password" data-testid="bulk-input-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="submittedBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Agent name" data-testid="bulk-input-submitted-by" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Shared property info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Property Information</CardTitle>
                <CardDescription className="text-xs">These details apply to every comp in this batch.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <FormField control={form.control} name="propertyName" render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Property Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Highwoods Plaza" data-testid="bulk-input-property-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="propertyAddress" render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Street Address *</FormLabel>
                    <FormControl><Input placeholder="123 Main St" data-testid="bulk-input-address" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input data-testid="bulk-input-city" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input maxLength={2} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="zipCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP</FormLabel>
                      <FormControl><Input placeholder="28301" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="bulk-select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="propertyClass" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Class *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="bulk-select-class">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROPERTY_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="buildingSize" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Building SF</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 85000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="yearBuilt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year Built</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 2010" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="parkingRatio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parking Ratio (per 1,000 SF)</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="e.g. 4.0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Comp rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold font-display">Lease Comps</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{fields.length} comp{fields.length !== 1 ? "s" : ""} — click a row to expand</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    append({ ...EMPTY_ROW });
                    setExpandedRows(prev => new Set([...prev, fields.length]));
                  }}
                  data-testid="bulk-btn-add-row"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Comp
                </Button>
              </div>

              {fields.map((field, i) => {
                const isExpanded = expandedRows.has(i);
                const hasError = rowHasError(i);
                const resultForRow = submitResult?.results.find(r => r.index === i);

                return (
                  <Card
                    key={field.id}
                    className={cn(
                      "transition-all",
                      hasError && "border-destructive/60",
                      resultForRow?.success && "border-green-500/50",
                      resultForRow && !resultForRow.success && "border-destructive/60"
                    )}
                    data-testid={`bulk-row-${i}`}
                  >
                    {/* Row header — always visible */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                      onClick={() => toggleRow(i)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                          <span className="text-sm font-medium truncate">
                            {form.watch(`comps.${i}.tenantName`) || <span className="text-muted-foreground italic">Tenant name...</span>}
                          </span>
                          {form.watch(`comps.${i}.suiteNumber`) && (
                            <span className="text-xs text-muted-foreground">· Ste {form.watch(`comps.${i}.suiteNumber`)}</span>
                          )}
                          {form.watch(`comps.${i}.leasedSF`) ? (
                            <span className="text-xs text-muted-foreground ml-auto mr-2 tabular-nums">
                              {Number(form.watch(`comps.${i}.leasedSF`)).toLocaleString()} SF
                              {form.watch(`comps.${i}.baseRent`) ? ` · $${form.watch(`comps.${i}.baseRent`)}/SF` : ""}
                            </span>
                          ) : null}
                        </div>
                        {hasError && (
                          <div className="flex items-center gap-1 mt-0.5 text-destructive text-[11px]">
                            <AlertCircle className="h-3 w-3" />
                            Missing required fields
                          </div>
                        )}
                        {resultForRow?.success && (
                          <div className="flex items-center gap-1 mt-0.5 text-green-600 dark:text-green-400 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Submitted successfully
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Duplicate this comp"
                          onClick={e => { e.stopPropagation(); duplicateRow(i); }}
                          data-testid={`bulk-btn-duplicate-${i}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {fields.length > 1 && (
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={e => { e.stopPropagation(); remove(i); setExpandedRows(prev => { const n = new Set(prev); n.delete(i); return n; }); }}
                            data-testid={`bulk-btn-remove-${i}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expandable body */}
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 px-4 border-t border-border">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 mt-4">

                          <FormField control={form.control} name={`comps.${i}.tenantName`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tenant Name *</FormLabel>
                              <FormControl><Input placeholder="e.g. Starbucks" data-testid={`bulk-tenant-${i}`} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.landlordName`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Landlord / Owner</FormLabel>
                              <FormControl><Input placeholder="e.g. Highwoods Properties" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.suiteNumber`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Suite / Unit #</FormLabel>
                              <FormControl><Input placeholder="Suite 200" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.leasedSF`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leased SF *</FormLabel>
                              <FormControl><Input type="number" placeholder="e.g. 3500" data-testid={`bulk-sf-${i}`} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.leaseType`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lease Structure</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select structure" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {LEASE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.baseRent`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Base Rent ($/SF/yr) *</FormLabel>
                              <FormControl><Input type="number" step="0.01" placeholder="e.g. 18.50" data-testid={`bulk-rent-${i}`} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.effectiveRent`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Effective Rent ($/SF/yr)</FormLabel>
                              <FormControl><Input type="number" step="0.01" placeholder="after concessions" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.leaseTermMonths`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lease Term (months) *</FormLabel>
                              <FormControl><Input type="number" placeholder="e.g. 60" data-testid={`bulk-term-${i}`} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.leaseStartDate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl><Input type="date" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.leaseEndDate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl><Input type="date" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.tiAllowance`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>TI Allowance ($/SF)</FormLabel>
                              <FormControl><Input type="number" step="0.01" placeholder="e.g. 30.00" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.freeRentMonths`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Free Rent (months)</FormLabel>
                              <FormControl><Input type="number" placeholder="e.g. 3" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.escalationRate`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Annual Escalation (%)</FormLabel>
                              <FormControl><Input type="number" step="0.1" placeholder="e.g. 3.0" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.landlordWork`} render={({ field }) => (
                            <FormItem className="col-span-full">
                              <FormLabel>Landlord Work</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Describe any build-out or improvements..." rows={2} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`comps.${i}.notes`} render={({ field }) => (
                            <FormItem className="col-span-full">
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Any additional context..." rows={2} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              {/* Add another row */}
              <button
                type="button"
                onClick={() => {
                  append({ ...EMPTY_ROW });
                  setExpandedRows(prev => new Set([...prev, fields.length]));
                }}
                className="w-full py-3 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all flex items-center justify-center gap-2"
                data-testid="bulk-btn-add-row-bottom"
              >
                <PlusCircle className="h-4 w-4" />
                Add another comp
              </button>
            </div>

            {/* Submit result summary */}
            {submitResult && (
              <Card className={submitResult.failed === 0 ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/20" : "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20"}>
                <CardContent className="py-4 flex items-center gap-3">
                  {submitResult.failed === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div className="text-sm">
                    <span className="font-semibold">{submitResult.succeeded} submitted successfully</span>
                    {submitResult.failed > 0 && <span className="text-muted-foreground"> · {submitResult.failed} failed — check highlighted rows</span>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-6">
              <Button type="button" variant="outline" onClick={() => navigate("/")} data-testid="bulk-btn-cancel">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={bulkMutation.isPending}
                className="min-w-[180px]"
                data-testid="bulk-btn-submit"
              >
                {bulkMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  `Submit ${fields.length} Comp${fields.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
