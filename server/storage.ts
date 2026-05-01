import { leaseComps } from '@shared/schema';
import type { LeaseComp, InsertLeaseComp } from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Initialize tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS lease_comps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_name TEXT NOT NULL,
    property_address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Fayetteville',
    state TEXT NOT NULL DEFAULT 'NC',
    zip_code TEXT,
    property_type TEXT NOT NULL,
    property_class TEXT NOT NULL,
    building_size REAL,
    year_built INTEGER,
    tenant_name TEXT NOT NULL,
    landlord_name TEXT,
    leased_sf REAL NOT NULL,
    lease_type TEXT,
    base_rent REAL NOT NULL,
    effective_rent REAL,
    lease_term_months INTEGER NOT NULL,
    lease_start_date TEXT,
    lease_end_date TEXT,
    ti_allowance REAL,
    free_rent_months INTEGER,
    landlord_work TEXT,
    escalation_rate REAL,
    suite_number TEXT,
    floor_level TEXT,
    parking_ratio REAL,
    notes TEXT,
    submitted_by TEXT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    source_document TEXT
  )
`);

export interface IStorage {
  getAllComps(): Promise<LeaseComp[]>;
  getCompById(id: number): Promise<LeaseComp | undefined>;
  getCompsByType(propertyType: string): Promise<LeaseComp[]>;
  createComp(comp: InsertLeaseComp): Promise<LeaseComp>;
  deleteComp(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllComps(): Promise<LeaseComp[]> {
    return db.select().from(leaseComps).orderBy(desc(leaseComps.submittedAt)).all();
  }

  async getCompById(id: number): Promise<LeaseComp | undefined> {
    return db.select().from(leaseComps).where(eq(leaseComps.id, id)).get();
  }

  async getCompsByType(propertyType: string): Promise<LeaseComp[]> {
    return db.select().from(leaseComps).where(eq(leaseComps.propertyType, propertyType)).orderBy(desc(leaseComps.submittedAt)).all();
  }

  async createComp(comp: InsertLeaseComp): Promise<LeaseComp> {
    const withDate = { ...comp, submittedAt: new Date().toISOString() };
    return db.insert(leaseComps).values(withDate).returning().get();
  }

  async deleteComp(id: number): Promise<void> {
    db.delete(leaseComps).where(eq(leaseComps.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
