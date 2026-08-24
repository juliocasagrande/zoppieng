import { useEffect, useRef, useState } from "react";
import type { FieldOptionCatalogItem, FieldOptionKey } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { TechTag } from "../../shared/components/TechTag.js";
import { Skeleton } from "../../shared/components/Skeleton.js";

const TABS: { key: FieldOptionKey; title: string; hint: string }[] = [
  { key: "device_type", title: "Tipo de dispositivo", hint: "Classificação do ponto de ancoragem mostrada em cada ficha de campo (padrão NBR 16325-1)." },
  { key: "system_type", title: "Tipo do sistema", hint: "Categoria do sistema de ancoragem descrita por ponto." },
  { key: "support_structure", title: "Estrutura suporte", hint: "Material/estrutura onde o dispositivo está fixado." },
  { key: "environment_condition", title: "Condição ambiental", hint: "Condição do ambiente ao redor do ponto." },
];

// Lets a company (or Zoppi staff, for the shared defaults) customize the
// image-illustrated option catalogs offered to the field technician for the
// four selection fields backed by field_option_catalog — same pattern as the
// accessory catalog, generalized across fields.
export function FieldOptionsAdminPage() {
  const [activeTab, setActiveTab] = useState<FieldOptionKey>("device_type");

  return (
    <div>
      <h1>Tipos e opções de campo</h1>
      <p style={{ maxWidth: 640, marginBottom: 20 }}>
        Personalize as opções (com imagens de referência) oferecidas ao técnico durante o preenchimento em campo, para ajudá-lo a escolher o item
        correto rapidamente.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: `1px solid ${activeTab === tab.key ? "var(--color-orange)" : "var(--color-gray-light)"}`,
              background: activeTab === tab.key ? "rgba(232,96,32,0.08)" : "var(--color-white)",
              color: activeTab === tab.key ? "var(--color-orange)" : "var(--color-text)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {TABS.map((tab) => (activeTab === tab.key ? <OptionCatalogManager key={tab.key} fieldKey={tab.key} hint={tab.hint} /> : null))}
    </div>
  );
}

function OptionCatalogManager({ fieldKey, hint }: { fieldKey: FieldOptionKey; hint: string }) {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "company_admin";
  const [items, setItems] = useState<FieldOptionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    api
      .get(`/field-options?fieldKey=${fieldKey}`)
      .then(setItems)
      .finally(() => setLoading(false));
  }
  useEffect(reload, [fieldKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await api.post("/field-options", { fieldKey, value: label.trim(), label: label.trim() });
    setLabel("");
    setShowForm(false);
    reload();
  }

  async function handleImageChange(item: FieldOptionCatalogItem, file: File) {
    setUploadingId(item.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const { path, signedUrl } = await api.post(`/field-options/${item.id}/image-upload-url`, { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
      await api.patch(`/field-options/${item.id}`, { image_path: path });
      reload();
    } finally {
      setUploadingId(null);
    }
  }

  async function handleRemove(item: FieldOptionCatalogItem) {
    await api.delete(`/field-options/${item.id}`);
    reload();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <p className="zp-eyebrow" style={{ maxWidth: 520 }}>
          {hint}
        </p>
        {canEdit && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nova opção"}</Button>}
      </div>

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate}>
            <FormField label="Nome da opção">
              <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} required />
            </FormField>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <OptionCardSkeleton key={i} />)
          : items.map((item) => (
              <OptionCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                uploading={uploadingId === item.id}
                onImageChange={(file) => handleImageChange(item, file)}
                onRemove={() => handleRemove(item)}
              />
            ))}
      </div>
    </div>
  );
}

function OptionCardSkeleton() {
  return (
    <Card padding={0}>
      <Skeleton height={100} radius={0} style={{ borderBottom: "1px solid var(--color-gray-light)" }} />
      <div style={{ padding: 16 }}>
        <Skeleton height={14} width="70%" />
      </div>
    </Card>
  );
}

function OptionCard({
  item,
  canEdit,
  uploading,
  onImageChange,
  onRemove,
}: {
  item: FieldOptionCatalogItem;
  canEdit: boolean;
  uploading: boolean;
  onImageChange: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canRemove = canEdit && item.scope === "company_custom";

  return (
    <Card padding={0}>
      <div
        style={{
          position: "relative",
          height: 100,
          borderBottom: "1px solid var(--color-gray-light)",
          background: "var(--color-off-white)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: canEdit ? "pointer" : "default",
        }}
        onClick={() => canEdit && fileInputRef.current?.click()}
        title={canEdit ? "Clique para alterar a imagem" : undefined}
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: "var(--color-gray)", fontSize: "0.78rem" }}>{uploading ? "Enviando..." : canEdit ? "Adicionar imagem" : "Sem imagem"}</span>
        )}
        {canEdit && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageChange(file);
              e.target.value = "";
            }}
          />
        )}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <strong style={{ fontSize: "0.88rem" }}>{item.label}</strong>
          <TechTag label={item.scope === "zoppi_standard" ? "Padrão Zoppi" : "Customizado"} />
        </div>
        {canRemove && (
          <div style={{ marginTop: 10 }}>
            <Button type="button" variant="outline" onClick={onRemove}>
              Remover
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
