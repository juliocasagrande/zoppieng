import { useEffect, useRef, useState } from "react";
import type { AccessoryCatalogItem } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { TechTag } from "../../shared/components/TechTag.js";
import { Skeleton } from "../../shared/components/Skeleton.js";
import { SearchInput } from "../../shared/components/SearchInput.js";

const CATEGORY_OPTIONS = [
  { value: "chumbador_quimico", label: "Chumbador químico" },
  { value: "chumbador_mecanico", label: "Chumbador mecânico" },
  { value: "olhal", label: "Olhal" },
  { value: "barra_roscada", label: "Barra roscada" },
  { value: "dinamometro", label: "Dinamômetro" },
  { value: "outro", label: "Outro" },
];

export function AccessoryCatalogPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "company_admin";
  const [items, setItems] = useState<AccessoryCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("outro");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  function reload() {
    api
      .get("/accessories")
      .then(setItems)
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  const searchTerm = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/accessories", { name, category });
    setName("");
    setShowForm(false);
    reload();
  }

  async function handleImageChange(item: AccessoryCatalogItem, file: File) {
    setUploadingId(item.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const { path, signedUrl } = await api.post(`/accessories/${item.id}/image-upload-url`, { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
      await api.patch(`/accessories/${item.id}`, { image_path: path });
      reload();
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Catálogo de acessórios</h1>
        {canEdit && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Novo item customizado"}</Button>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar acessório..." />
        <select style={{ ...inputStyle, flex: "0 1 200px" }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Categoria — todas</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate}>
            <FormField label="Nome">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
            </FormField>
            <FormField label="Categoria">
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <AccessoryCardSkeleton key={i} />)
          : filteredItems.map((item) => (
              <AccessoryCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                uploading={uploadingId === item.id}
                onImageChange={(file) => handleImageChange(item, file)}
              />
            ))}
      </div>
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <p style={{ color: "var(--color-gray)" }}>Nenhum acessório encontrado para esse filtro.</p>
      )}
    </div>
  );
}

function AccessoryCardSkeleton() {
  return (
    <Card padding={0}>
      <Skeleton height={140} radius={0} style={{ borderBottom: "1px solid var(--color-gray-light)" }} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <Skeleton height={16} width="55%" />
          <Skeleton height={18} width={70} radius={12} />
        </div>
        <Skeleton height={10} width="35%" style={{ marginBottom: 10 }} />
        <Skeleton height={12} width="45%" style={{ marginBottom: 6 }} />
        <Skeleton height={12} width="40%" />
      </div>
    </Card>
  );
}

function AccessoryCard({
  item,
  canEdit,
  uploading,
  onImageChange,
}: {
  item: AccessoryCatalogItem;
  canEdit: boolean;
  uploading: boolean;
  onImageChange: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card padding={0}>
      <div
        style={{
          position: "relative",
          height: 140,
          borderBottom: "1px solid var(--color-gray-light)",
          background: "var(--color-gray-lightest, #f4f5f7)",
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
          <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: "var(--color-gray-mid, #9aa0a6)", fontSize: "0.8rem" }}>
            {uploading ? "Enviando..." : canEdit ? "Adicionar imagem" : "Sem imagem"}
          </span>
        )}
        {uploading && item.image_url && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
            }}
          >
            Enviando...
          </div>
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

      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong>{item.name}</strong>
          <TechTag label={item.scope === "zoppi_standard" ? "Padrão Zoppi" : "Customizado"} />
        </div>
        <div className="zp-eyebrow">{item.category}</div>
        {item.spec_diameter_mm && <p style={{ fontSize: "0.85rem" }}>Diâmetro: {item.spec_diameter_mm}mm</p>}
        {item.spec_load_capacity_kn && <p style={{ fontSize: "0.85rem" }}>Capacidade: {item.spec_load_capacity_kn}kN</p>}
      </div>
    </Card>
  );
}
