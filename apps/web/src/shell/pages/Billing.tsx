import { useEffect, useState } from "react";
import type { ModuleSubscription, SubscriptionPlan } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Button } from "../../shared/components/Button.js";
import { Alert } from "../../shared/components/Alert.js";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  cancelled: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Inadimplente",
  cancelled: "Cancelada",
};

export function BillingPage() {
  const { profile, refreshProfile } = useAuth();
  const [subscriptions, setSubscriptions] = useState<(ModuleSubscription & { modules?: { name: string } })[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [subscribingModuleId, setSubscribingModuleId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function reload() {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    Promise.all([
      api.get(`/subscriptions/companies/${profile.company_id}`),
      api.get("/subscriptions/plans"),
    ])
      .then(([subscriptionData, planData]) => {
        setSubscriptions(subscriptionData);
        setPlans(planData);
      })
      .catch((err) => {
        setLoadFailed(true);
        setMessage({ tone: "danger", text: err instanceof Error ? err.message.replace(/^"|"$/g, "") : "Não foi possível carregar as assinaturas." });
      })
      .finally(() => setLoading(false));
  }
  useEffect(reload, [profile?.company_id]);

  async function cancel(id: string) {
    if (!window.confirm("Deseja cancelar esta assinatura?")) return;
    await api.post(`/subscriptions/${id}/cancel`);
    await refreshProfile();
    reload();
  }

  async function subscribe(plan: SubscriptionPlan) {
    if (!profile?.company_id) return;
    setSubscribingModuleId(plan.moduleId);
    setMessage(null);
    try {
      const result = await api.post("/subscriptions", {
        companyId: profile.company_id,
        moduleId: plan.moduleId,
        planCode: plan.planCode,
      });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setMessage({ tone: "success", text: "Assinatura criada no ambiente de desenvolvimento." });
      await refreshProfile();
      reload();
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof Error ? err.message.replace(/^"|"$/g, "") : "Não foi possível iniciar a assinatura." });
    } finally {
      setSubscribingModuleId(null);
    }
  }

  const availablePlans = plans.filter(
    (plan) => !subscriptions.some((sub) => sub.module_id === plan.moduleId && (sub.status === "active" || sub.status === "trialing")),
  );

  return (
    <div>
      <h1>Assinatura</h1>
      {message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {!profile?.company_id && <Alert tone="info">Selecione uma empresa para gerenciar suas assinaturas.</Alert>}
      {loading && <p>Carregando assinaturas...</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {subscriptions.map((sub) => (
          <Card className="zp-subscription-card" key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{sub.modules?.name ?? "Módulo"}</div>
              <div className="zp-eyebrow">
                R$ {(sub.monthly_amount_cents / 100).toFixed(2)}/mês · {sub.plan_code}
              </div>
            </div>
            <div className="zp-subscription-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <StatusBadge label={STATUS_LABEL[sub.status]} tone={STATUS_TONE[sub.status]} />
              {sub.status !== "cancelled" && (
                <Button variant="outline" onClick={() => cancel(sub.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!loading && !loadFailed && subscriptions.length === 0 && availablePlans.length === 0 && (
          <Card>
            <p>Nenhum plano disponível no momento.</p>
          </Card>
        )}
      </div>

      {!loading && availablePlans.length > 0 && (
        <section style={{ marginTop: subscriptions.length > 0 ? 32 : 0 }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 12 }}>{subscriptions.length > 0 ? "Outros planos" : "Planos disponíveis"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {availablePlans.map((plan) => {
              const previous = subscriptions.find((sub) => sub.module_id === plan.moduleId);
              return (
                <Card className="zp-plan-card" key={`${plan.moduleId}:${plan.planCode}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{plan.moduleName}</div>
                    <div style={{ color: "var(--color-gray)", fontSize: "0.9rem", marginTop: 4 }}>{plan.planName}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", marginTop: 10 }}>
                      {(plan.monthlyAmountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", fontWeight: 500, color: "var(--color-gray)" }}>/mês</span>
                    </div>
                  </div>
                  <Button type="button" disabled={subscribingModuleId === plan.moduleId} onClick={() => subscribe(plan)} style={{ whiteSpace: "nowrap" }}>
                    {subscribingModuleId === plan.moduleId ? "Abrindo checkout..." : previous ? "Assinar novamente" : "Assinar agora"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
