import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getPaymentProvider } from "../../providers/payment/index.js";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

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
  const body = req.body as { companyId: string; moduleId: string; planCode: string; monthlyAmountCents: number; payerEmail: string };
  if (req.user!.role === "company_admin" && req.user!.companyId !== body.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const provider = getPaymentProvider();
  const created = await provider.createSubscription({
    companyId: body.companyId,
    moduleId: body.moduleId,
    planCode: body.planCode,
    monthlyAmountCents: body.monthlyAmountCents,
    payerEmail: body.payerEmail,
  });

  const { data, error } = await supabaseAdmin
    .from("module_subscriptions")
    .upsert(
      {
        company_id: body.companyId,
        module_id: body.moduleId,
        plan_code: body.planCode,
        monthly_amount_cents: body.monthlyAmountCents,
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

// Mercado Pago webhook — unauthenticated (verified by shared secret / payload
// shape), updates subscription status from the authoritative provider state.
export const paymentWebhookRouter = Router();
paymentWebhookRouter.post("/mercadopago", async (req, res) => {
  const provider = getPaymentProvider();
  const event = provider.parseWebhook(req.body, req.headers as Record<string, string>);
  if (!event) return res.status(200).json({ ok: true });

  await supabaseAdmin
    .from("module_subscriptions")
    .update({ status: event.status })
    .eq("mercadopago_subscription_id", event.providerSubscriptionId);

  res.status(200).json({ ok: true });
});
