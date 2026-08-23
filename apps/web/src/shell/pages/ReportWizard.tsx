import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { REPORT_NAME_PRESETS } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Button } from "../../shared/components/Button.js";
import { Alert } from "../../shared/components/Alert.js";

const CUSTOM_NAME = "__custom__";
const NEW_PARTY = "__new__";
const NEW_SITE = "__new__";

interface SavedParty {
  legalName: string;
  cnpj: string | null;
  address: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

interface SavedSite {
  siteIdentification: string;
  siteAddress: string | null;
}

interface PartyState {
  legalName: string;
  cnpj: string;
  address: string;
}

const emptyParty: PartyState = { legalName: "", cnpj: "", address: "" };

type StepId = "name" | "contratada" | "contratante" | "site" | "review";

const STEPS: { id: StepId; title: string }[] = [
  { id: "name", title: "Nome do laudo" },
  { id: "contratada", title: "Contratada" },
  { id: "contratante", title: "Contratante" },
  { id: "site", title: "Local" },
  { id: "review", title: "Revisão" },
];

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

export function ReportWizardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [namePreset, setNamePreset] = useState(REPORT_NAME_PRESETS[0]);
  const [customName, setCustomName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteIdentification, setSiteIdentification] = useState("");
  const [contratante, setContratante] = useState<PartyState>(emptyParty);
  const [contratada, setContratada] = useState<PartyState>(emptyParty);
  const [savedContratantes, setSavedContratantes] = useState<SavedParty[]>([]);
  const [savedContratadas, setSavedContratadas] = useState<SavedParty[]>([]);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/reports/parties/saved")
      .then((data: { contratante: SavedParty[]; contratada: SavedParty[] }) => {
        setSavedContratantes(data.contratante ?? []);
        setSavedContratadas(data.contratada ?? []);
      })
      .catch(() => {});
    api
      .get("/reports/sites/saved")
      .then((data: SavedSite[]) => setSavedSites(data ?? []))
      .catch(() => {});
  }, []);

  function selectSaved(list: SavedParty[], legalName: string, setParty: (p: PartyState) => void) {
    if (legalName === NEW_PARTY) {
      setParty(emptyParty);
      return;
    }
    const match = list.find((p) => p.legalName === legalName);
    if (match) setParty({ legalName: match.legalName, cnpj: match.cnpj ?? "", address: match.address ?? "" });
  }

  function selectSavedSite(identification: string) {
    if (identification === NEW_SITE) {
      setSiteIdentification("");
      setSiteAddress("");
      return;
    }
    const match = savedSites.find((s) => s.siteIdentification === identification);
    if (match) {
      setSiteIdentification(match.siteIdentification);
      setSiteAddress(match.siteAddress ?? "");
    }
  }

  function isStepValid(id: StepId): boolean {
    if (id === "name") return namePreset !== CUSTOM_NAME || customName.trim().length > 0;
    if (id === "contratada") return contratada.legalName.trim().length > 0;
    if (id === "contratante") return contratante.legalName.trim().length > 0;
    return true;
  }

  function goTo(index: number) {
    if (index > maxReached) return;
    setError(null);
    setStepIndex(index);
  }

  function goNext() {
    if (!isStepValid(STEPS[stepIndex].id)) {
      setError("Preencha os campos obrigatórios para continuar.");
      return;
    }
    setError(null);
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    if (!profile?.company_id) {
      setError("Seu usuário não está vinculado a uma empresa assinante.");
      return;
    }
    if (!isStepValid("name") || !isStepValid("contratada") || !isStepValid("contratante")) {
      setError("Existem campos obrigatórios não preenchidos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await api.post("/reports", {
        companyId: profile.company_id,
        name: namePreset === CUSTOM_NAME ? customName : namePreset,
        siteAddress,
        siteIdentification,
        contratante: { legalName: contratante.legalName, cnpj: contratante.cnpj || undefined, address: contratante.address || undefined },
        contratada: { legalName: contratada.legalName, cnpj: contratada.cnpj || undefined, address: contratada.address || undefined },
      });
      navigate(`/app/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar laudo");
    } finally {
      setLoading(false);
    }
  }

  const step = STEPS[stepIndex];
  const reportName = namePreset === CUSTOM_NAME ? customName : namePreset;

  return (
    <div style={{ width: "100%" }}>
      <h1>Novo laudo de Ancoragem</h1>

      <StepProgress steps={STEPS} current={stepIndex} maxReached={maxReached} onSelect={goTo} />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <Card style={{ padding: "clamp(20px, 4vw, 32px)" }}>
        {step.id === "name" && (
          <div>
            <FormField label="Nome do laudo">
              <select style={inputStyle} value={namePreset} onChange={(e) => setNamePreset(e.target.value)}>
                {REPORT_NAME_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
                <option value={CUSTOM_NAME}>Personalizado…</option>
              </select>
            </FormField>
            {namePreset === CUSTOM_NAME && (
              <FormField label="Nome personalizado">
                <input style={inputStyle} value={customName} onChange={(e) => setCustomName(e.target.value)} autoFocus />
              </FormField>
            )}
          </div>
        )}

        {step.id === "contratada" && (
          <PartyFields
            title="Empresa onde será feito o laudo (contratada)"
            saved={savedContratadas}
            party={contratada}
            onSelectSaved={(name) => selectSaved(savedContratadas, name, setContratada)}
            onChange={setContratada}
          />
        )}

        {step.id === "contratante" && (
          <PartyFields
            title="Empresa contratante"
            saved={savedContratantes}
            party={contratante}
            onSelectSaved={(name) => selectSaved(savedContratantes, name, setContratante)}
            onChange={setContratante}
          />
        )}

        {step.id === "site" && (
          <SiteFields
            saved={savedSites}
            siteIdentification={siteIdentification}
            siteAddress={siteAddress}
            onSelectSaved={selectSavedSite}
            onChangeIdentification={setSiteIdentification}
            onChangeAddress={setSiteAddress}
          />
        )}

        {step.id === "review" && (
          <ReviewStep
            reportName={reportName}
            contratada={contratada}
            contratante={contratante}
            siteIdentification={siteIdentification}
            siteAddress={siteAddress}
            onEdit={goTo}
          />
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0} style={{ flex: "1 1 140px" }}>
            ← Voltar
          </Button>
          {step.id === "review" ? (
            <Button type="button" onClick={handleSubmit} disabled={loading} style={{ flex: "2 1 200px" }}>
              {loading ? "Criando…" : "Criar laudo"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} style={{ flex: "2 1 200px" }}>
              Próximo →
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function StepProgress({
  steps,
  current,
  maxReached,
  onSelect,
}: {
  steps: { id: StepId; title: string }[];
  current: number;
  maxReached: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 20px" }}>
      {steps.map((s, i) => {
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(i)}
            disabled={!reachable}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: "var(--radius)",
              border: `1px solid ${active ? "var(--color-orange)" : "var(--color-gray-light)"}`,
              background: active ? "rgba(232,96,32,0.08)" : "var(--color-white)",
              color: active ? "var(--color-orange)" : reachable ? "var(--color-text)" : "var(--color-gray)",
              cursor: reachable ? "pointer" : "default",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: active ? "var(--color-orange)" : "var(--color-gray-light)",
                color: active ? "#fff" : "var(--color-gray)",
                fontSize: "0.7rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            {s.title}
          </button>
        );
      })}
    </div>
  );
}

function PartyFields({
  title,
  saved,
  party,
  onSelectSaved,
  onChange,
}: {
  title: string;
  saved: SavedParty[];
  party: PartyState;
  onSelectSaved: (legalName: string) => void;
  onChange: (party: PartyState) => void;
}) {
  return (
    <div>
      <div className="zp-eyebrow" style={{ marginBottom: 12 }}>
        {title}
      </div>
      {saved.length > 0 && (
        <FormField label="Empresa salva">
          <select
            style={inputStyle}
            value={saved.some((p) => p.legalName === party.legalName) ? party.legalName : NEW_PARTY}
            onChange={(e) => onSelectSaved(e.target.value)}
          >
            <option value={NEW_PARTY}>Nova empresa…</option>
            {saved.map((p) => (
              <option key={p.legalName} value={p.legalName}>
                {p.legalName}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <div style={gridStyle}>
        <FormField label="Razão social">
          <input style={inputStyle} value={party.legalName} onChange={(e) => onChange({ ...party, legalName: e.target.value })} />
        </FormField>
        <FormField label="CNPJ">
          <input style={inputStyle} value={party.cnpj} onChange={(e) => onChange({ ...party, cnpj: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Endereço">
        <input style={inputStyle} value={party.address} onChange={(e) => onChange({ ...party, address: e.target.value })} />
      </FormField>
    </div>
  );
}

function SiteFields({
  saved,
  siteIdentification,
  siteAddress,
  onSelectSaved,
  onChangeIdentification,
  onChangeAddress,
}: {
  saved: SavedSite[];
  siteIdentification: string;
  siteAddress: string;
  onSelectSaved: (identification: string) => void;
  onChangeIdentification: (v: string) => void;
  onChangeAddress: (v: string) => void;
}) {
  return (
    <div>
      <div className="zp-eyebrow" style={{ marginBottom: 12 }}>
        Local onde será feito o laudo
      </div>
      {saved.length > 0 && (
        <FormField label="Local salvo">
          <select
            style={inputStyle}
            value={saved.some((s) => s.siteIdentification === siteIdentification) ? siteIdentification : NEW_SITE}
            onChange={(e) => onSelectSaved(e.target.value)}
          >
            <option value={NEW_SITE}>Novo local…</option>
            {saved.map((s) => (
              <option key={s.siteIdentification} value={s.siteIdentification}>
                {s.siteIdentification}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <div style={gridStyle}>
        <FormField label="Identificação da obra/planta">
          <input style={inputStyle} value={siteIdentification} onChange={(e) => onChangeIdentification(e.target.value)} />
        </FormField>
        <FormField label="Endereço do local">
          <input style={inputStyle} value={siteAddress} onChange={(e) => onChangeAddress(e.target.value)} />
        </FormField>
      </div>
    </div>
  );
}

function ReviewStep({
  reportName,
  contratada,
  contratante,
  siteIdentification,
  siteAddress,
  onEdit,
}: {
  reportName: string;
  contratada: PartyState;
  contratante: PartyState;
  siteIdentification: string;
  siteAddress: string;
  onEdit: (index: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ReviewRow title="Nome do laudo" onEdit={() => onEdit(0)}>
        <p style={{ margin: 0 }}>{reportName || "—"}</p>
      </ReviewRow>
      <ReviewRow title="Contratada" onEdit={() => onEdit(1)}>
        <PartySummary party={contratada} />
      </ReviewRow>
      <ReviewRow title="Contratante" onEdit={() => onEdit(2)}>
        <PartySummary party={contratante} />
      </ReviewRow>
      <ReviewRow title="Local" onEdit={() => onEdit(3)}>
        <p style={{ margin: 0 }}>{siteIdentification || "—"}</p>
        {siteAddress && <p style={{ margin: "2px 0 0", color: "var(--color-gray)" }}>{siteAddress}</p>}
      </ReviewRow>
    </div>
  );
}

function ReviewRow({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-gray-light)",
        borderRadius: "var(--radius)",
        padding: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 200 }}>
        <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
          {title}
        </div>
        {children}
      </div>
      <Button type="button" variant="outline" onClick={onEdit}>
        Editar
      </Button>
    </div>
  );
}

function PartySummary({ party }: { party: PartyState }) {
  if (!party.legalName) return <p style={{ margin: 0, color: "var(--color-gray)" }}>Não preenchido</p>;
  return (
    <div>
      <p style={{ margin: 0, fontWeight: 600 }}>{party.legalName}</p>
      {party.cnpj && <p style={{ margin: "2px 0 0" }}>{party.cnpj}</p>}
      {party.address && <p style={{ margin: "2px 0 0", color: "var(--color-gray)" }}>{party.address}</p>}
    </div>
  );
}
