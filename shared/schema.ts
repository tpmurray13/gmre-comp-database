import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leaseComps = sqliteTable("lease_comps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Property identification
  propertyName: text("property_name").notNull(),
  propertyAddress: text("property_address").notNull(),
  city: text("city").notNull().default("Fayetteville"),
  state: text("state").notNull().default("NC"),
  zipCode: text("zip_code"),
  // Property classification
  propertyType: text("property_type").notNull(), // office, retail, industrial, medical, flex, land, multifamily
  propertyClass: text("property_class").notNull(), // A, B, C
  buildingSize: real("building_size"), // total building SF
  yearBuilt: integer("year_built"),
  // Lease details
  tenantName: text("tenant_name").notNull(),
  landlordName: text("landlord_name"),
  leasedSF: real("leased_sf").notNull(), // SF leased in this deal
  leaseType: text("lease_type"), // NNN, FS, MG, Gross
  baseRent: real("base_rent").notNull(), // per SF per year
  effectiveRent: real("effective_rent"), // after concessions
  leaseTermMonths: integer("lease_term_months").notNull(),
  leaseStartDate: text("lease_start_date"),
  leaseEndDate: text("lease_end_date"),
  // Concessions & work
  tiAllowance: real("ti_allowance"), // $/SF TI allowance
  freeRentMonths: integer("free_rent_months"),
  landlordWork: text("landlord_work"), // description of landlord work done
  escalationRate: real("escalation_rate"), // annual % escalation
  // Additional deal details
  suiteNumber: text("suite_number"),
  floorLevel: text("floor_level"),
  parkingRatio: real("parking_ratio"), // per 1000 SF
  notes: text("notes"),
  // Submission metadata
  submittedBy: text("submitted_by"),
  submittedAt: text("submitted_at").notNull().default(new Date().toISOString()),
  sourceDocument: text("source_document"), // filename of uploaded doc
});

export const insertLeaseCompSchema = createInsertSchema(leaseComps).omit({
  id: true,
  submittedAt: true,
});

export type InsertLeaseComp = z.infer<typeof insertLeaseCompSchema>;
export type LeaseComp = typeof leaseComps.$inferSelect;

// Enums for dropdowns
export const PROPERTY_TYPES = ["Office", "Retail", "Industrial", "Medical/Healthcare", "Flex", "Mixed-Use", "Land"] as const;
export const PROPERTY_CLASSES = ["Class A", "Class B", "Class C"] as const;
export const LEASE_TYPES = ["NNN", "Full Service", "Modified Gross", "Gross", "Absolute Net"] as const;
