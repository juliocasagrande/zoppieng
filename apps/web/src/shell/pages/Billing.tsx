import { useEffect, useState } from "react";
import type { ModuleSubscription } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Button } from "../../shared/components/Button.js";

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
  const { profile } = useAuth();
  const [subscriptions, setSubscriptions] = useState<(ModuleSubscription & { modules?: { name: string } })[]>([]);

  function reload() {
    if (profile?.company_id) api.get(`/subscriptions/companies/${profile.company_id}`).then(setSubscriptions);
  }
  useEffect(reload, [profile?.company_id]);

  async function cancel(id: string) {
    await api.post(`/subscriptions/${id}/cancel`);
    reload();
  }

  return (
    <div>
      <h1>Assinatura</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {subscriptions.map((sub) => (
          <Card key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{sub.modules?.name ?? "Módulo"}</div>
              <div className="zp-eyebrow">
                R$ {(sub.monthly_amount_cents / 100).toFixed(2)}/mês · {sub.plan_code}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <StatusBadge label={STATUS_LABEL[sub.status]} tone={STATUS_TONE[sub.status]} />
              {sub.status !== "cancelled" && (
                <Button variant="outline" onClick={() => cancel(sub.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          </Card>
        ))}
        {subscriptions.length === 0 && (
          <Card>
            <p>Nenhuma assinatura ativa.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
