import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { RegistryEngineer, RegistryEngineerDocument } from "@zoppi/shared";
import { ENGINEER_DOCUMENT_TYPE_LABELS } from "@zoppi/shared";
import { api } from "../../../lib/api.js";
import { useAuth } from "../../AuthContext.js";
import { Card } from "../../../shared/components/Card.js";
import { Button } from "../../../shared/components/Button.js";
import { FormField, inputStyle } from "../../../shared/components/FormField.js";
import { Skeleton } from "../../../shared/components/Skeleton.js";
import { RegistryCrudPage, isOwnedByViewer, type RegistryWizardStep } from "./RegistryCrudPage.js";

const DOC_TYPE_OPTIONS = Object.entries(ENGINEER_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const TABS = [
  { key: "engineers", title: "Dados cadastrais" },
  { key: "documents", title: "Documentação" },
] as const;

// Two-level "Cadastro" branch: the sidebar links here with ?tab= for each
// sub-item (see Sidebar.tsx), same tab pattern as FieldOptionsAdmin.tsx.
export function RegistryEngineersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "documents" ? "documents" : "engineers";
  const { profile } = useAuth();
  const canEdit = profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer" || profile?.role === "company_admin";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSearchParams(tab.key === "engineers" ? {} : { tab: tab.key })}
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

      {activeTab === "engineers" ? <EngineersTab canEdit={canEdit} /> : <DocumentsTab canEdit={canEdit} />}
    </div>
  );
}

const ENGINEER_STEPS: RegistryWizardStep[] = [
  {
    id: "dados-pessoais",
    title: "Dados pessoais",
    color: "var(--color-navy)",
    fields: [
      { key: "full_name", label: "Nome completo", required: true },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
    ],
  },
  {
    id: "crea",
    title: "CREA e especialidade",
    color: "var(--color-orange)",
    fields: [
      { key: "crea_number", label: "Número CREA" },
      { key: "crea_state", label: "CREA — UF" },
      { key: "specialty", label: "Especialidade" },
    ],
  },
  {
    id: "observacoes",
    title: "Observações",
    color: "var(--color-navy-light)",
    fields: [{ key: "notes", label: "Observações", type: "textarea" }],
  },
];

function EngineersTab({ canEdit }: { canEdit: boolean }) {
  return (
    <RegistryCrudPage<RegistryEngineer>
      title="Engenheiros"
      description="Engenheiros que atuam nas suas inspeções. Um Engenheiro Zoppi que se cadastra aqui registra os próprios dados — usados em qualquer empresa que ele atenda, não só numa."
      endpoint="/registry/engineers"
      canEdit={canEdit}
      emptyForm={{ full_name: "" }}
      steps={ENGINEER_STEPS}
      ownershipMode="personal-for-engineer"
      searchFields={["full_name", "crea_number", "email"]}
      renderSummary={(row) => ({
        heading: row.full_name,
        lines: [
          [row.crea_number, row.crea_state].filter(Boolean).join("/"),
          [row.specialty, row.phone].filter(Boolean).join(" · "),
        ].filter((line) => line.length > 0),
      })}
    />
  );
}

function DocumentsTab({ canEdit }: { canEdit: boolean }) {
  const { profile } = useAuth();
  const [engineers, setEngineers] = useState<RegistryEngineer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [documents, setDocuments] = useState<RegistryEngineerDocument[]>([]);
  const [loadingEngineers, setLoadingEngineers] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [docType, setDocType] = useState<string>("outro");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/registry/engineers")
      .then((data: RegistryEngineer[]) => {
        setEngineers(data);
        if (data.length > 0) setSelectedId((current) => current || data[0].id);
      })
      .finally(() => setLoadingEngineers(false));
  }, []);

  function reloadDocuments(engineerId: string) {
    setLoadingDocs(true);
    api
      .get(`/registry/engineers/${engineerId}/documents`)
      .then(setDocuments)
      .finally(() => setLoadingDocs(false));
  }

  useEffect(() => {
    if (selectedId) reloadDocuments(selectedId);
    else setDocuments([]);
  }, [selectedId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !selectedId) return;
    await api.post(`/registry/engineers/${selectedId}/documents`, {
      label: label.trim(),
      doc_type: docType,
      issued_at: issuedAt || null,
      expires_at: expiresAt || null,
    });
    setLabel("");
    setDocType("outro");
    setIssuedAt("");
    setExpiresAt("");
    setShowForm(false);
    reloadDocuments(selectedId);
  }

  async function handleUpload(doc: RegistryEngineerDocument, file: File) {
    setUploadingId(doc.id);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const { path, signedUrl } = await api.post(`/registry/engineer-documents/${doc.id}/upload-url`, { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      await api.patch(`/registry/engineer-documents/${doc.id}`, { storage_path: path });
      reloadDocuments(selectedId);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDelete(doc: RegistryEngineerDocument) {
    await api.delete(`/registry/engineer-documents/${doc.id}`);
    reloadDocuments(selectedId);
  }

  if (loadingEngineers) return <Skeleton height={38} width={280} />;

  if (engineers.length === 0) {
    return <p style={{ color: "var(--color-gray)" }}>Cadastre um engenheiro na aba "Dados cadastrais" antes de anexar documentos.</p>;
  }

  // A company can see (read-only) the personal profile of an engineer who
  // has served it, so the engineer picker here can list rows the viewer
  // doesn't own — only the actual owner (or zoppi_admin) may add/edit docs.
  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedId);
  const canManageSelected = canEdit && isOwnedByViewer(selectedEngineer ?? {}, profile);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <FormField label="Engenheiro">
          <select style={inputStyle} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {engineers.map((engineer) => (
              <option key={engineer.id} value={engineer.id}>
                {engineer.full_name}
              </option>
            ))}
          </select>
        </FormField>
        {canManageSelected && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Novo documento"}</Button>}
      </div>

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <FormField label="Descrição">
                <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} required />
              </FormField>
              <FormField label="Tipo">
                <select style={inputStyle} value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Emitido em">
                <input style={inputStyle} type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
              </FormField>
              <FormField label="Válido até">
                <input style={inputStyle} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </FormField>
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {loadingDocs
          ? Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <Skeleton height={14} width="40%" />
              </Card>
            ))
          : documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                canEdit={canManageSelected}
                uploading={uploadingId === doc.id}
                onUpload={(file) => handleUpload(doc, file)}
                onDelete={() => handleDelete(doc)}
              />
            ))}
        {!loadingDocs && documents.length === 0 && <p style={{ color: "var(--color-gray)" }}>Nenhum documento anexado para este engenheiro.</p>}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  canEdit,
  uploading,
  onUpload,
  onDelete,
}: {
  doc: RegistryEngineerDocument;
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <strong>{doc.label}</strong>
          <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--color-gray)" }}>
            {[ENGINEER_DOCUMENT_TYPE_LABELS[doc.doc_type], doc.expires_at ? `válido até ${doc.expires_at}` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {doc.storage_url && (
              <Button type="button" variant="outline" onClick={() => window.open(doc.storage_url!, "_blank", "noopener")}>
                Ver arquivo
              </Button>
            )}
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? "Enviando..." : doc.storage_path ? "Substituir arquivo" : "Anexar arquivo"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="destructive" onClick={onDelete}>
              Excluir
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
