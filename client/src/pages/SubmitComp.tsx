import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
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
import { insertLeaseCompSchema, PROPERTY_TYPES, PROPERTY_CLASSES, LEASE_TYPES } from "@shared/schema";
import { z } from "zod";
import { Loader2, Sparkles, CheckCircle2, FileText, AlertCircle, User } from "lucide-react";

const formSchema = insertLeaseCompSchema.extend({
  baseRent: z.coerce.number().positive("Enter a valid rent"),
  leasedSF: z.coerce.number().positive("Enter a valid SF"),
  leaseTermMonths: z.coerce.number().int().positive("Enter a valid term"),
  buildingSize: z.coerce.number().positive().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  yearBuilt: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  effectiveRent: z.coerce.number().positive().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  tiAllowance: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  freeRentMonths: z.coerce.number().int().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  escalationRate: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
  parkingRatio: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(v => v === "" ? undefined : Number(v)),
});

type FormValues = z.infer<typeof formSchema>;

const SECTION_CLASS = "grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4";

export default function SubmitComp() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyName: "", propertyAddress: "", city: "Fayetteville", state: "NC", zipCode: "",
      propertyType: "", propertyClass: "", tenantName: "", landlordName: "", suiteNumber: "",
      leaseType: "", leaseStartDate: "", leaseEndDate: "", landlordWork: "", notes: "",
      submittedBy: "", floorLevel: "", sourceDocument: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/comps", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comps"] });
      toast({ title: "Comp submitted!", description: "It's now live in the database." });
      navigate("/");
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  async function handleExtract(file: File) {
    setIsExtracting(true);
    setExtractError(null);
    setExtractedFileName(null);

    const formData = new FormData();
    formData.append("document", file);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        if (json.isImagePdf) {
          throw new Error("This PDF is a scanned image — text can't be read from it. Try a digitally-created PDF (e.g. exported from Word or a digital lease system), or enter the details manually.");
        }
        throw new Error(json.error || "Extraction failed");
      }

      const ex = json.extracted;
      setExtractedFileName(json.fileName);

      const fieldMap: Partial<Record<keyof FormValues, unknown>> = {
        propertyName: ex.propertyName,
        propertyAddress: ex.propertyAddress,
        city: ex.city,
        state: ex.state,
        zipCode: ex.zipCode,
        propertyType: ex.propertyType,
        propertyClass: ex.propertyClass,
        buildingSize: ex.buildingSize,
        yearBuilt: ex.yearBuilt,
        tenantName: ex.tenantName,
        landlordName: ex.landlordName,
        leasedSF: ex.leasedSF,
        leaseType: ex.leaseType,
        baseRent: ex.baseRent,
        effectiveRent: ex.effectiveRent,
        leaseTermMonths: ex.leaseTermMonths,
        leaseStartDate: ex.leaseStartDate,
        leaseEndDate: ex.leaseEndDate,
        tiAllowance: ex.tiAllowance,
        freeRentMonths: ex.freeRentMonths,
        landlordWork: ex.landlordWork,
        escalationRate: ex.escalationRate,
        suiteNumber: ex.suiteNumber,
        parkingRatio: ex.parkingRatio,
        notes: ex.notes,
        sourceDocument: json.fileName,
      };

      // Use reset to set all extracted values at once — most reliable way to
      // populate both text inputs AND controlled Select components in RHF
      const current = form.getValues();
      const merged: FormValues = { ...current };
      Object.entries(fieldMap).forEach(([key, value]) => {
        if (value != null && value !== "") {
          (merged as Record<string, unknown>)[key] = value;
        }
      });
      form.reset(merged);

      toast({
        title: "Document parsed",
        description: `AI extracted data from "${json.fileName}". Review and correct any fields before submitting.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract";
      setExtractError(msg);
      toast({ title: "Extraction failed", description: msg, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }

  function onSubmit(data: FormValues) {
    submitMutation.mutate(data);
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div>
          <h1 className="text-xl font-bold font-display">Submit a Lease Comp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a document for AI extraction, or fill in the fields manually.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Agent name */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 font-display">
                  <User className="h-4 w-4 text-primary" />
                  Submitted By
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="submittedBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Agent name" data-testid="input-submitted-by" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* AI Document Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 font-display">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI Document Extraction
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">optional</span>
                </CardTitle>
                <CardDescription className="text-xs">Upload a lease, rent roll, or property brochure (PDF, DOC, TXT) and AI will pre-fill the form.</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleExtract(file);
                  }}
                  data-testid="input-file-upload"
                />
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("border-primary", "bg-muted/30"); }}
                  onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-muted/30"); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-muted/30");
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleExtract(file);
                  }}
                  data-testid="dropzone-upload"
                >
                  {isExtracting ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm">Extracting data from document...</span>
                    </div>
                  ) : extractedFileName ? (
                    <div className="flex flex-col items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-8 w-8" />
                      <span className="text-sm font-medium">Extracted from "{extractedFileName}"</span>
                      <span className="text-xs text-muted-foreground">Click to upload a different file</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <span className="text-sm font-medium">Drop a file here or click to browse</span>
                      <span className="text-xs">PDF, DOC, DOCX, TXT · up to 20MB</span>
                    </div>
                  )}
                </div>
                {extractError && (
                  <div className="flex items-start gap-2 mt-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {extractError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Property Information</CardTitle>
              </CardHeader>
              <CardContent className={SECTION_CLASS}>
                <FormField control={form.control} name="propertyName" render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Property Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Cross Creek Village" data-testid="input-property-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="propertyAddress" render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Street Address *</FormLabel>
                    <FormControl><Input placeholder="123 Main St" data-testid="input-property-address" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input data-testid="input-city" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input maxLength={2} data-testid="input-state" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="zipCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP</FormLabel>
                      <FormControl><Input placeholder="28301" data-testid="input-zip" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-property-type">
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
                        <SelectTrigger data-testid="select-property-class">
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
                    <FormControl><Input type="number" placeholder="e.g. 50000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="yearBuilt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year Built</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 2002" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="suiteNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suite / Unit #</FormLabel>
                    <FormControl><Input placeholder="Suite 200" {...field} /></FormControl>
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

            {/* Lease Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Lease Details</CardTitle>
              </CardHeader>
              <CardContent className={SECTION_CLASS}>
                <FormField control={form.control} name="tenantName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. USAA Real Estate" data-testid="input-tenant" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="landlordName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Landlord / Owner</FormLabel>
                    <FormControl><Input placeholder="e.g. Highwoods Properties" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leasedSF" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leased SF *</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 5000" data-testid="input-leased-sf" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leaseType" render={({ field }) => (
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
                <FormField control={form.control} name="baseRent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Rent ($/SF/yr) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g. 18.50" data-testid="input-base-rent" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="effectiveRent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Rent ($/SF/yr)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="after concessions" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leaseTermMonths" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease Term (months) *</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 60" data-testid="input-lease-term" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="escalationRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Escalation (%)</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="e.g. 3.0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leaseStartDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease Start Date</FormLabel>
                    <FormControl><Input type="date" data-testid="input-start-date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leaseEndDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease End Date</FormLabel>
                    <FormControl><Input type="date" data-testid="input-end-date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Concessions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Concessions & Landlord Work</CardTitle>
              </CardHeader>
              <CardContent className={SECTION_CLASS}>
                <FormField control={form.control} name="tiAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>TI Allowance ($/SF)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g. 25.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="freeRentMonths" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Free Rent (months)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="landlordWork" render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Landlord Work Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe any build-out or improvements provided by landlord..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional context, deal structure details, or comments..." rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3 pb-6">
              <Button type="button" variant="outline" onClick={() => navigate("/")} data-testid="btn-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={submitMutation.isPending} className="min-w-[140px]" data-testid="btn-submit-comp">
                {submitMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                ) : "Submit Comp"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
