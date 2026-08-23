// Zod validation schemas shared between API request handlers and web forms.
import { z } from "zod";

export const createReportSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(3),
  siteAddress: z.string().optional(),
  siteIdentification: z.string().optional(),
  contratante: z.object({
    companyId: z.string().uuid().optional(),
    legalName: z.string().min(1),
    cnpj: z.string().optional(),
    address: z.string().optional(),
    contactName: z.string().optional(),
    contactRole: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
  }),
  contratada: z.object({
    companyId: z.string().uuid().optional(),
    legalName: z.string().min(1),
    cnpj: z.string().optional(),
    address: z.string().optional(),
    contactName: z.string().optional(),
    contactRole: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional(),
  }),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const anchorPointSchema = z.object({
  tag: z.string().min(1),
  accessoryId: z.string().uuid().nullable().optional(),
  installationMode: z.enum(["quimico", "mecanico"]).nullable().optional(),
  anchorDepthMm: z.number().nonnegative().nullable().optional(),
  distanceBetweenPointsMm: z.number().nonnegative().nullable().optional(),
  testInstrument: z.string().nullable().optional(),
  testAppliedLoadKn: z.number().nonnegative().nullable().optional(),
  testDurationSeconds: z.number().int().nonnegative().nullable().optional(),
  testResult: z.enum(["aprovado", "atencao", "reprovado"]).nullable().optional(),
  notes: z.string().nullable().optional(),
  issueTags: z.array(z.string()).default([]),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type AnchorPointInput = z.infer<typeof anchorPointSchema>;

// Site address/identification are filled by the subscriber company at report
// creation time (spec: the technician just captures data in the field, not
// company/site paperwork) — the field submission never touches them.
export const fieldSubmissionSchema = z.object({
  anchorPoints: z.array(
    anchorPointSchema.extend({
      photoIds: z.array(z.string().uuid()).default([]),
    }),
  ),
});
export type FieldSubmissionInput = z.infer<typeof fieldSubmissionSchema>;

export const accessoryCatalogItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  manufacturer: z.string().optional(),
  specDiameterMm: z.number().nonnegative().nullable().optional(),
  specLoadCapacityKn: z.number().nonnegative().nullable().optional(),
  specNotes: z.string().optional(),
});
export type AccessoryCatalogItemInput = z.infer<typeof accessoryCatalogItemSchema>;
