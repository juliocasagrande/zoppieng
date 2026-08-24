// Zod validation schemas shared between API request handlers and web forms.
import { z } from "zod";

export const createReportSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(3),
  description: z.string().optional(),
  siteAddress: z.string().optional(),
  siteIdentification: z.string().optional(),
  siteArea: z.string().optional(),
  surveyDate: z.string().optional(),
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
  deviceType: z.string().nullable().optional(),
  anchorDepthMm: z.number().nonnegative().nullable().optional(),
  distanceBetweenPointsMm: z.number().nonnegative().nullable().optional(),
  testInstrument: z.string().nullable().optional(),
  testReferenceLoadKgf: z.number().nonnegative().nullable().optional(),
  testAppliedLoadKgf: z.number().nonnegative().nullable().optional(),
  testDurationSeconds: z.number().int().nonnegative().nullable().optional(),
  testLoadDirection: z.string().nullable().optional(),
  testResult: z.enum(["aprovado", "atencao", "reprovado"]).nullable().optional(),
  fixationMaterialReference: z.string().nullable().optional(),
  systemType: z.string().nullable().optional(),
  systemPurpose: z.string().nullable().optional(),
  capacityUsers: z.string().nullable().optional(),
  supportStructure: z.string().nullable().optional(),
  fixationModeDetail: z.string().nullable().optional(),
  environmentCondition: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  issueTags: z.array(z.string()).default([]),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type AnchorPointInput = z.infer<typeof anchorPointSchema>;

// Site address/identification are filled by the subscriber company at report
// creation time (spec: the technician just captures data in the field, not
// company/site paperwork) — the field submission never touches them. The
// test equipment and who performed the field work are captured once per
// report (one dynamometer covers every point in a visit), not per point.
export const fieldSubmissionSchema = z.object({
  fieldExecutorName: z.string().nullable().optional(),
  fieldExecutorRole: z.string().nullable().optional(),
  accompanyingClientName: z.string().nullable().optional(),
  accompanyingClientRole: z.string().nullable().optional(),
  testEquipmentManufacturer: z.string().nullable().optional(),
  testEquipmentModel: z.string().nullable().optional(),
  testEquipmentSerial: z.string().nullable().optional(),
  testEquipmentCapacityKgf: z.number().nonnegative().nullable().optional(),
  anchorPoints: z.array(
    anchorPointSchema.extend({
      photoIds: z.array(z.string().uuid()).default([]),
    }),
  ),
});
export type FieldSubmissionInput = z.infer<typeof fieldSubmissionSchema>;

// Fields the engineer authors/curates during review — the narrative and
// tabular sections of the master laudo template that the field technician
// never touches (objective/scope, system rastreabilidade, C/NC/NA checklist,
// non-conformities, revision control, periodic-inspection history).
export const verificationCheckItemSchema = z.object({
  label: z.string().min(1),
  situation: z.enum(["C", "NC", "NA"]).nullable().optional(),
  observation: z.string().nullable().optional(),
});

export const reportComponentSchema = z.object({
  item: z.string().min(1),
  manufacturerModel: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  lotSerial: z.string().nullable().optional(),
  document: z.string().nullable().optional(),
});

export const nonConformitySchema = z.object({
  id: z.string().min(1),
  pointTag: z.string().nullable().optional(),
  description: z.string().min(1),
  severity: z.enum(["atencao", "critica"]),
  actionRequired: z.string().nullable().optional(),
  status: z.enum(["aberta", "em_andamento", "resolvida"]),
});

export const revisionEntrySchema = z.object({
  revision: z.string().min(1),
  date: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const inspectionHistoryEntrySchema = z.object({
  date: z.string().nullable().optional(),
  pointOrSystem: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  documentNote: z.string().nullable().optional(),
});

export const reviewDetailsSchema = z.object({
  artNumber: z.string().nullable().optional(),
  osContractNumber: z.string().nullable().optional(),
  revision: z.string().optional(),
  objectiveText: z.string().nullable().optional(),
  scopeText: z.string().nullable().optional(),
  recommendationsText: z.string().nullable().optional(),
  conclusionText: z.string().nullable().optional(),
  verificationChecks: z.array(verificationCheckItemSchema).optional(),
  components: z.array(reportComponentSchema).optional(),
  nonconformities: z.array(nonConformitySchema).optional(),
  revisions: z.array(revisionEntrySchema).optional(),
  inspectionHistory: z.array(inspectionHistoryEntrySchema).optional(),
});
export type ReviewDetailsInput = z.infer<typeof reviewDetailsSchema>;

// The engineer's confirmation of a single anchor point's pass/fail verdict
// during review — distinct from the technician's suggested testResult on
// anchorPointSchema above, which the field wizard submits.
export const confirmPointResultSchema = z.object({
  testResult: z.enum(["aprovado", "atencao", "reprovado"]),
});
export type ConfirmPointResultInput = z.infer<typeof confirmPointResultSchema>;

export const attachmentCategorySchema = z.enum([
  "art",
  "calibration_certificate",
  "site_plan",
  "datasheet",
  "project_memorial",
  "lab_report",
  "point_labels",
  "other",
]);

export const reportAttachmentConfirmSchema = z.object({
  path: z.string().min(1),
  category: attachmentCategorySchema,
  label: z.string().min(1),
});
export type ReportAttachmentConfirmInput = z.infer<typeof reportAttachmentConfirmSchema>;

export const fieldOptionKeySchema = z.enum(["device_type", "system_type", "support_structure", "environment_condition"]);

export const fieldOptionCatalogItemSchema = z.object({
  fieldKey: fieldOptionKeySchema,
  value: z.string().min(1),
  label: z.string().min(1),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type FieldOptionCatalogItemInput = z.infer<typeof fieldOptionCatalogItemSchema>;

export const accessoryCatalogItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  manufacturer: z.string().optional(),
  specDiameterMm: z.number().nonnegative().nullable().optional(),
  specLoadCapacityKn: z.number().nonnegative().nullable().optional(),
  specNotes: z.string().optional(),
});
export type AccessoryCatalogItemInput = z.infer<typeof accessoryCatalogItemSchema>;
