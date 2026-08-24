import { Router } from "express";
import { z } from "zod";
import type { SubscriptionPlan } from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getPaymentProvider } from "../../providers/payment/index.js";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

const PLAN_CATALOG: Record<string, { planCode: string; planName: string; monthlyAmountCents: number }> = {
  ancoragem: { planCode: "standard", planName: "Plano mensal", monthlyAmountCents: 29_900 },
};

subscriptionsRouter.get("/plans", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("modules").select("id, slug, name").eq("active", true).order("name");
  if (error) return res.status(500).json({ error: error.message });

  const plans: SubscriptionPlan[] = (data ?? []).flatMap((module) => {
    const plan = PLAN_CATALOG[module.slug];
    return plan
      ? [{ moduleId: module.id, moduleSlug: module.slug, moduleName: module.name, ...plan }]
      : [];
  });
  res.json(plans);
});

subscriptionsRouter.get("/companies/:companyId", async (req, res) => {
  if (req.user!.role === "company_admin" || req.user!.role === "company_operational") {
    if (req.user!.companyId !== req.params.companyId) return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin
    .from("module_subscriptions")
    .select("*, modules(slug, name)")
    .eq("company_id", req.params.companyId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

subscriptionsRouter.post("/", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const parsed = z
    .object({ companyId: z.string().uuid(), moduleId: z.string().uuid(), planCode: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  if (req.user!.role === "company_admin" && req.user!.companyId !== body.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: module, error: moduleError } = await supabaseAdmin
    .from("modules")
    .select("id, slug")
    .eq("id", body.moduleId)
    .eq("active", true)
    .single();
  const plan = module ? PLAN_CATALOG[module.slug] : undefined;
  if (moduleError || !plan || plan.planCode !== body.planCode) {
    return res.status(400).json({ error: "Plano de assinatura inválido." });
  }

  const { data: existing } = await supabaseAdmin
    .from("module_subscriptions")
    .select("status")
    .eq("company_id", body.companyId)
    .eq("module_id", body.moduleId)
    .maybeSingle();
  if (existing?.status === "active" || existing?.status === "trialing") {
    return res.status(409).json({ error: "Este módulo já possui uma assinatura vigente." });
  }

  const provider = getPaymentProvider();
  const created = await provider.createSubscription({
    companyId: body.companyId,
    moduleId: body.moduleId,
    planCode: plan.planCode,
    monthlyAmountCents: plan.monthlyAmountCents,
    payerEmail: req.user!.email,
  });

  const { data, error } = await supabaseAdmin
    .from("module_subscriptions")
    .upsert(
      {
        company_id: body.companyId,
        module_id: body.moduleId,
        plan_code: plan.planCode,
        monthly_amount_cents: plan.monthlyAmountCents,
        mercadopago_subscription_id: created.providerSubscriptionId,
        status: "trialing",
      },
      { onConflict: "company_id,module_id" },
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ subscription: data, checkoutUrl: created.checkoutUrl });
});

subscriptionsRouter.post("/:id/cancel", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { data: sub, error: fetchError } = await supabaseAdmin
    .from("module_subscriptions")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (fetchError || !sub) return res.status(404).json({ error: "Subscription not found" });
  if (req.user!.role === "company_admin" && req.user!.companyId !== sub.company_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const provider = getPaymentProvider();
  if (sub.mercadopago_subscription_id) {
    await provider.cancelSubscription(sub.mercadopago_subscription_id);
  }

  const { data, error } = await supabaseAdmin
    .from("module_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Mercado Pago webhook — unauthenticated notification. The payload only
// identifies the subscription; access changes use the provider's live state.
export const paymentWebhookRouter = Router();
paymentWebhookRouter.post("/mercadopago", async (req, res) => {
  const provider = getPaymentProvider();
  const event = provider.parseWebhook(req.body, req.headers as Record<string, string>, req.query as Record<string, unknown>);
  if (!event) return res.status(200).json({ ok: true });

  const status = await provider.getSubscriptionStatus(event.providerSubscriptionId);
  if (!status) return res.status(200).json({ ok: true });

  await supabaseAdmin
    .from("module_subscriptions")
    .update({ status })
    .eq("mercadopago_subscription_id", event.providerSubscriptionId);

  res.status(200).json({ ok: true });
});
