import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Report } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { supabase } from "../../lib/supabaseClient.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";

export function ReviewQueuePage() {
  const [reports, setReports] = useState<(Report & { companies?: { legal_name: string } })[]>([]);

  function reload() {
    api.get("/review/queue").then(setReports);
  }
  useEffect(reload, []);

  async function assignToMe(id: string) {
    const { data: me } = await supabase.auth.getUser();
    await api.post(`/review/${id}/assign`, { engineerId: me.user?.id });
    reload();
  }

  return (
    <div>
      <h1>Fila de revisão</h1>
      {reports.length === 0 ? (
        <Card>
          <p>Nenhum laudo aguardando revisão.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map((r) => (
            <Card key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="zp-eyebrow">{r.companies?.legal_name}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="outline" onClick={() => assignToMe(r.id)}>
                  Atribuir a mim
                </Button>
                <Link to={`/app/reports/${r.id}`}>
                  <Button variant="secondary">Revisar</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
