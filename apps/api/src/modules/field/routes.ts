import { Router } from "express";
import crypto from "node:crypto";
import { fieldSubmissionSchema } from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireFieldToken } from "../../middleware/fieldToken.js";
import { getNotificationProvider } from "../../providers/notification/index.js";

export const fieldRouter = Router();

function withImageUrl<T extends { image_path: string | null }>(bucket: string, item: T): T & { image_url: string | null } {
  const image_url = item.image_path ? supabaseAdmin.storage.from(bucket).getPublicUrl(item.image_path).data.publicUrl : null;
  return { ...item, image_url };
}

const FIELD_OPTION_KEYS = ["device_type", "system_type", "support_structure", "environment_condition"] as const;

// GET /field/:token — welcome data for the field wizard (report name,
// requesting company, previously-filled anchor points on a correction link,
// customizable option catalogs for the picker fields).
fieldRouter.get("/:token", requireFieldToken, async (req, res) => {
  const { data: report } = await supabaseAdmin
    .from("reports")
    .select("id, name, site_address, site_identification, company_id, companies(legal_name)")
    .eq("id", req.fieldLink!.reportId)
    .single();
  const companyId = (report as any)?.company_id;
  const [{ data: anchorPoints }, { data: accessories }, { data: tips }, { data: fieldOptionRows }] = await Promise.all([
    supabaseAdmin.from("anchor_points").select("*, photos(*)").eq("report_id", req.fieldLink!.reportId).order("sort_order"),
    supabaseAdmin.from("accessory_catalog").select("*").eq("active", true).or(`scope.eq.zoppi_standard,company_id.eq.${companyId}`),
    supabaseAdmin.from("best_practices_content").select("*").eq("active", true).order("sort_order"),
    supabaseAdmin
      .from("field_option_catalog")
      .select("*")
      .eq("active", true)
      .or(`scope.eq.zoppi_standard,company_id.eq.${companyId}`)
      .order("sort_order")
      .order("label"),
  ]);

  const fieldOptions = Object.fromEntries(
    FIELD_OPTION_KEYS.map((key) => [key, (fieldOptionRows ?? []).filter((o) => o.field_key === key).map((o) => withImageUrl("field-option-images", o))]),
  );

  res.json({
    report,
    anchorPoints,
    accessories: (accessories ?? []).map((a) => withImageUrl("accessory-images", a)),
    tips,
    fieldOptions,
  });
});

// POST /field/:token/photos — returns a signed upload URL for a single photo.
// The client (possibly offline) uploads directly to Supabase Storage, then
// registers the resulting path via /field/:token/photos/confirm.
fieldRouter.post("/:token/photos/upload-url", requireFieldToken, async (req, res) => {
  const ext = (req.body?.ext as string) ?? "jpg";
  const path = `${req.fieldLink!.reportId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("report-photos").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});

fieldRouter.post("/:token/photos/confirm", requireFieldToken, async (req, res) => {
  const { path, anchorPointId, isExtra, caption } = req.body as { path: string; anchorPointId?: string; isExtra?: boolean; caption?: string };
  const { data, error } = await supabaseAdmin
    .from("photos")
    .insert({
      report_id: req.fieldLink!.reportId,
      anchor_point_id: anchorPointId ?? null,
      storage_path: path,
      is_extra: !!isExtra,
      caption: caption ?? null,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// POST /field/:token/submit — final submission. Upserts all anchor points and
// flips the report to in_review, then marks the link used (single use).
fieldRouter.post("/:token/submit", requireFieldToken, async (req, res) => {
  const parsed = fieldSubmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;
  const reportId = req.fieldLink!.reportId;

  for (const [index, point] of input.anchorPoints.entries()) {
    const { data: existing } = await supabaseAdmin
      .from("anchor_points")
      .select("id")
      .eq("report_id", reportId)
      .eq("tag", point.tag)
      .maybeSingle();

    const row = {
      report_id: reportId,
      tag: point.tag,
      accessory_id: point.accessoryId ?? null,
      installation_mode: point.installationMode ?? null,
      device_type: point.deviceType ?? null,
      anchor_depth_mm: point.anchorDepthMm ?? null,
      distance_between_points_mm: point.distanceBetweenPointsMm ?? null,
      test_instrument: point.testInstrument ?? null,
      test_reference_load_kgf: point.testReferenceLoadKgf ?? null,
      test_applied_load_kgf: point.testAppliedLoadKgf ?? null,
      test_duration_seconds: point.testDurationSeconds ?? null,
      test_load_direction: point.testLoadDirection ?? null,
      test_result: point.testResult ?? null,
      fixation_material_reference: point.fixationMaterialReference ?? null,
      system_type: point.systemType ?? null,
      system_purpose: point.systemPurpose ?? null,
      capacity_users: point.capacityUsers ?? null,
      support_structure: point.supportStructure ?? null,
      fixation_mode_detail: point.fixationModeDetail ?? null,
      environment_condition: point.environmentCondition ?? null,
      notes: point.notes ?? null,
      issue_tags: point.issueTags ?? [],
      sort_order: point.sortOrder ?? index,
    };

    let anchorPointId = existing?.id;
    if (existing) {
      const { error } = await supabaseAdmin.from("anchor_points").update(row).eq("id", existing.id);
      if (error) return res.status(500).json({ error: `Falha ao salvar ${point.tag}: ${error.message}` });
    } else {
      const { data: created, error } = await supabaseAdmin.from("anchor_points").insert(row).select("id").single();
      if (error) return res.status(500).json({ error: `Falha ao salvar ${point.tag}: ${error.message}` });
      anchorPointId = created?.id;
    }

    if (anchorPointId && point.photoIds.length) {
      const { error } = await supabaseAdmin.from("photos").update({ anchor_point_id: anchorPointId }).in("id", point.photoIds);
      if (error) return res.status(500).json({ error: `Falha ao vincular fotos de ${point.tag}: ${error.message}` });
    }
  }

  await supabaseAdmin
    .from("reports")
    .update({
      status: "in_review",
      field_executor_name: input.fieldExecutorName ?? null,
      field_executor_role: input.fieldExecutorRole ?? null,
      field_executor_accepted_at: input.fieldExecutorName ? new Date().toISOString() : null,
      accompanying_client_name: input.accompanyingClientName ?? null,
      accompanying_client_role: input.accompanyingClientRole ?? null,
      accompanying_client_accepted_at: input.accompanyingClientName ? new Date().toISOString() : null,
      test_equipment_manufacturer: input.testEquipmentManufacturer ?? null,
      test_equipment_model: input.testEquipmentModel ?? null,
      test_equipment_serial: input.testEquipmentSerial ?? null,
      test_equipment_capacity_kgf: input.testEquipmentCapacityKgf ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  await supabaseAdmin.from("report_field_links").update({ status: "used", used_at: new Date().toISOString() }).eq("id", req.fieldLink!.id);

  const { data: report } = await supabaseAdmin.from("reports").select("name, companies(contact_email)").eq("id", reportId).single();
  const recipient = (report as any)?.companies?.contact_email;
  if (recipient) {
    const provider = getNotificationProvider("email");
    const sendResult = await provider.send({
      to: recipient,
      subject: `Zoppi — laudo "${report?.name}" recebido, aguardando revisão`,
      body: `<p>Os dados de campo do laudo <strong>${report?.name}</strong> foram recebidos e entraram na fila de revisão de engenharia.</p>`,
    });
    await supabaseAdmin.from("notifications_log").insert({
      report_id: reportId,
      channel: "email",
      event_type: "awaiting_review",
      recipient,
      status: sendResult.status,
      provider_reference: sendResult.providerReference,
    });
  }

  res.json({ ok: true });
});
