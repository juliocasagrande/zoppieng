import { useEffect, useState } from "react";
import type { BestPracticeContent } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";

export function BestPracticesPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<BestPracticeContent[]>([]);

  useEffect(() => {
    api.get("/best-practices").then(setItems);
  }, []);

  return (
    <div>
      <h1>Mini manual de boas práticas</h1>
      {profile?.role === "zoppi_admin" && (
        <p className="zp-eyebrow" style={{ marginBottom: 16 }}>
          Conteúdo gerenciável — edição completa via API (/best-practices), tela dedicada de administração pode ser adicionada aqui.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => (
          <Card key={item.id}>
            <h3 style={{ fontSize: "0.95rem" }}>{item.title}</h3>
            <div dangerouslySetInnerHTML={{ __html: item.body_html }} />
          </Card>
        ))}
      </div>
    </div>
  );
}
