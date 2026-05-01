import type { Express, Request, Response } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { insertLeaseCompSchema } from '@shared/schema';
import multer from "multer";
import path from "path";
import fs from "fs";

// multer for file uploads
const upload = multer({
  dest: "/tmp/gmre-uploads/",
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // GET all comps
  app.get("/api/comps", async (_req: Request, res: Response) => {
    try {
      const comps = await storage.getAllComps();
      res.json(comps);
    } catch {
      res.status(500).json({ error: "Failed to fetch comps" });
    }
  });

  // GET comps with search filters: ?propertyType=Office&minSF=1000&maxSF=5000
  app.get("/api/comps/search", async (req: Request, res: Response) => {
    try {
      const { propertyType, minSF, maxSF } = req.query as Record<string, string>;
      let comps = await storage.getAllComps();
      if (propertyType && propertyType !== "All") {
        comps = comps.filter(c => c.propertyType === propertyType);
      }
      if (minSF) {
        const min = parseFloat(minSF);
        if (!isNaN(min)) comps = comps.filter(c => c.leasedSF != null && c.leasedSF >= min);
      }
      if (maxSF) {
        const max = parseFloat(maxSF);
        if (!isNaN(max)) comps = comps.filter(c => c.leasedSF != null && c.leasedSF <= max);
      }
      res.json(comps);
    } catch {
      res.status(500).json({ error: "Failed to search comps" });
    }
  });

  // GET single comp
  app.get("/api/comps/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const comp = await storage.getCompById(id);
      if (!comp) return res.status(404).json({ error: "Not found" });
      res.json(comp);
    } catch {
      res.status(500).json({ error: "Failed to fetch comp" });
    }
  });

  // POST create single comp
  app.post("/api/comps", async (req: Request, res: Response) => {
    try {
      const parsed = insertLeaseCompSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const comp = await storage.createComp(parsed.data);
      res.status(201).json(comp);
    } catch {
      res.status(500).json({ error: "Failed to create comp" });
    }
  });

  // POST bulk create comps
  app.post("/api/comps/bulk", async (req: Request, res: Response) => {
    try {
      const { comps } = req.body;
      if (!Array.isArray(comps) || comps.length === 0) {
        return res.status(400).json({ error: "comps must be a non-empty array" });
      }
      if (comps.length > 50) {
        return res.status(400).json({ error: "Maximum 50 comps per bulk submission" });
      }

      const results: { index: number; success: boolean; id?: number; error?: string }[] = [];
      for (let i = 0; i < comps.length; i++) {
        const parsed = insertLeaseCompSchema.safeParse(comps[i]);
        if (!parsed.success) {
          results.push({ index: i, success: false, error: parsed.error.flatten().fieldErrors as unknown as string });
        } else {
          try {
            const created = await storage.createComp(parsed.data);
            results.push({ index: i, success: true, id: created.id });
          } catch {
            results.push({ index: i, success: false, error: "Database error" });
          }
        }
      }

      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      res.status(201).json({ succeeded, failed, results });
    } catch {
      res.status(500).json({ error: "Bulk submission failed" });
    }
  });

  // DELETE comp
  app.delete("/api/comps/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteComp(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete comp" });
    }
  });

  // POST extract data from uploaded document (AI parsing)
  app.post("/api/extract", upload.single("document"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let fileText = "";
      const ext = path.extname(req.file.originalname).toLowerCase();

      if (ext === ".txt") {
        fileText = fs.readFileSync(req.file.path, "utf-8").slice(0, 8000);
      } else if (ext === ".pdf") {
        try {
          const pdfParse = (await import("pdf-parse")).default;
          const buf = fs.readFileSync(req.file.path);
          const data = await pdfParse(buf);
          fileText = data.text.slice(0, 8000);
        } catch {
          fileText = `[PDF file: ${req.file.originalname} - text extraction unavailable, please fill fields manually]`;
        }
      } else {
        fileText = `[File: ${req.file.originalname} - binary file, text not extractable]`;
      }

      const prompt = `You are a commercial real estate data extraction assistant. Extract lease and property information from the following document text and return ONLY a JSON object with these exact keys (use null for any field not found):

{
  "propertyName": string,
  "propertyAddress": string,
  "city": string,
  "state": string,
  "zipCode": string,
  "propertyType": one of ["Office","Retail","Industrial","Medical/Healthcare","Flex","Mixed-Use","Land"] or null,
  "propertyClass": one of ["Class A","Class B","Class C"] or null,
  "buildingSize": number (total building SF) or null,
  "yearBuilt": number or null,
  "tenantName": string,
  "landlordName": string or null,
  "leasedSF": number (SF of this lease),
  "leaseType": one of ["NNN","Full Service","Modified Gross","Gross","Absolute Net"] or null,
  "baseRent": number (annual $/SF) or null,
  "effectiveRent": number (annual $/SF after concessions) or null,
  "leaseTermMonths": number or null,
  "leaseStartDate": string (YYYY-MM-DD) or null,
  "leaseEndDate": string (YYYY-MM-DD) or null,
  "tiAllowance": number ($/SF) or null,
  "freeRentMonths": number or null,
  "landlordWork": string description or null,
  "escalationRate": number (%) or null,
  "suiteNumber": string or null,
  "parkingRatio": number (per 1000 SF) or null,
  "notes": string or null
}

Document text:
${fileText}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const extracted = JSON.parse(completion.choices[0].message.content || "{}");
      fs.unlinkSync(req.file.path);

      res.json({
        extracted,
        fileName: req.file.originalname,
        tokensUsed: completion.usage?.total_tokens,
      });
    } catch (err: unknown) {
      try { fs.unlinkSync(req.file!.path); } catch {}
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "Extraction failed: " + message });
    }
  });

  // POST extract BULK data from a rent roll / property brochure — returns array of leases
  app.post("/api/extract-bulk", upload.single("document"), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let fileText = "";
      const ext = path.extname(req.file.originalname).toLowerCase();

      if (ext === ".txt") {
        fileText = fs.readFileSync(req.file.path, "utf-8").slice(0, 24000);
      } else if (ext === ".pdf") {
        try {
          const pdfParse = (await import("pdf-parse")).default;
          const buf = fs.readFileSync(req.file.path);
          const data = await pdfParse(buf);
          fileText = data.text.slice(0, 24000);
        } catch {
          fileText = `[PDF: ${req.file.originalname} - text extraction failed]`;
        }
      } else {
        fileText = `[File: ${req.file.originalname}]`;
      }

      const prompt = `You are a commercial real estate data extraction assistant. This document is a property brochure, rent roll, or offering memorandum that may contain multiple tenants/leases.

Extract ALL leases/tenants found and return ONLY a JSON object with this exact structure:

{
  "property": {
    "propertyName": string or null,
    "propertyAddress": string or null,
    "city": string or null,
    "state": string or null,
    "zipCode": string or null,
    "propertyType": one of ["Office","Retail","Industrial","Medical/Healthcare","Flex","Mixed-Use","Land"] or null,
    "propertyClass": one of ["Class A","Class B","Class C"] or null,
    "buildingSize": number or null,
    "yearBuilt": number or null,
    "parkingRatio": number or null,
    "landlordName": string or null
  },
  "leases": [
    {
      "tenantName": string,
      "suiteNumber": string or null,
      "leasedSF": number or null,
      "leaseType": one of ["N","NN","NNN","Full Service","Modified Gross","Gross","Absolute Net"] or null,
      "baseRent": number (annual $/SF) or null,
      "effectiveRent": number or null,
      "leaseTermMonths": number or null,
      "leaseStartDate": string (YYYY-MM-DD) or null,
      "leaseEndDate": string (YYYY-MM-DD) or null,
      "tiAllowance": number ($/SF) or null,
      "freeRentMonths": number or null,
      "landlordWork": string or null,
      "escalationRate": number (%) or null,
      "notes": string or null
    }
  ]
}

If rent is listed as monthly $/SF, multiply by 12 to get annual. If rent is listed as monthly total, divide by leasedSF then multiply by 12.
Include every tenant row you find — do not skip any.

Document text:
${fileText}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const extracted = JSON.parse(completion.choices[0].message.content || "{}");
      fs.unlinkSync(req.file.path);

      res.json({
        property: extracted.property || {},
        leases: extracted.leases || [],
        fileName: req.file.originalname,
        tokensUsed: completion.usage?.total_tokens,
      });
    } catch (err: unknown) {
      try { fs.unlinkSync(req.file!.path); } catch {}
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "Bulk extraction failed: " + message });
    }
  });

  return httpServer;
}
