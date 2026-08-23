import { useEffect, useState } from "react";
import type { AccessoryCatalogItem } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { TechTag } from "../../shared/components/TechTag.js";

export function AccessoryCatalogPage() {
  const [items, setItems] = useState<AccessoryCatalogItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("outro");

  function reload() {
    api.get("/accessories").then(setItems);
  }
  useEffect(reload, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/accessories", { name, category });
    setName("");
    setShowForm(false);
    reload();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Catálogo de acessórios</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Novo item customizado"}</Button>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate}>
            <FormField label="Nome">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
            </FormField>
            <FormField label="Categoria">
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="chumbador_quimico">Chumbador químico</option>
                <option value="chumbador_mecanico">Chumbador mecânico</option>
                <option value="olhal">Olhal</option>
                <option value="barra_roscada">Barra roscada</option>
                <option value="dinamometro">Dinamômetro</option>
                <option value="outro">Outro</option>
              </select>
            </FormField>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {items.map((item) => (
          <Card key={item.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <strong>{item.name}</strong>
              <TechTag label={item.scope === "zoppi_standard" ? "Padrão Zoppi" : "Customizado"} />
            </div>
            <div className="zp-eyebrow">{item.category}</div>
            {item.spec_diameter_mm && <p style={{ fontSize: "0.85rem" }}>Diâmetro: {item.spec_diameter_mm}mm</p>}
            {item.spec_load_capacity_kn && <p style={{ fontSize: "0.85rem" }}>Capacidade: {item.spec_load_capacity_kn}kN</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
