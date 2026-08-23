import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../lib/api.js";
import { Button } from "../shared/components/Button.js";
import { Card } from "../shared/components/Card.js";
import { FormField, inputStyle } from "../shared/components/FormField.js";
import { Alert } from "../shared/components/Alert.js";
import { useOnlineStatus } from "./useOnlineStatus.js";
import {
  addPhoto,
  cacheWelcomeData,
  getCachedWelcomeData,
  getPhotosForToken,
  getProgress,
  saveProgress,
  type LocalAnchorPoint,
  type LocalPhoto,
  type LocalProgress,
} from "./offline/db.js";
import { syncToken } from "./offline/sync.js";

interface WelcomeData {
  report: { name: string; site_address: string | null; site_identification: string | null; companies?: { legal_name: string } };
  accessories: { id: string; name: string }[];
  tips: { slug: string; title: string; summary: string | null; step_context: string | null }[];
}

function emptyPoint(tag: string): LocalAnchorPoint {
  return {
    tag,
    accessoryId: null,
    installationMode: null,
    anchorDepthMm: null,
    distanceBetweenPointsMm: null,
    testInstrument: null,
    testAppliedLoadKn: null,
    testDurationSeconds: null,
    testResult: null,
    notes: null,
  };
}

type Step = "welcome" | "site" | number | "review" | "done";

export function FieldWizard() {
  const { token = "" } = useParams();
  const online = useOnlineStatus();

  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LocalProgress | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [step, setStep] = useState<Step>("welcome");
  const [syncStatus, setSyncStatus] = useState<string>("");

  useEffect(() => {
    publicApi
      .get(`/field/${token}`)
      .then((data) => {
        setWelcome(data);
        cacheWelcomeData(token, data);
      })
      .catch(async () => {
        const cached = await getCachedWelcomeData(token);
        if (cached) {
          setWelcome(cached as WelcomeData);
        } else {
          setLoadError("Sem conexão e sem dados salvos localmente para este link. Conecte-se ao menos uma vez para carregar o laudo.");
        }
      });
    getProgress(token).then(setProgress);
    getPhotosForToken(token).then(setPhotos);
  }, [token]);

  const refreshPhotos = useCallback(() => getPhotosForToken(token).then(setPhotos), [token]);

  async function persist(next: LocalProgress) {
    setProgress(next);
    await saveProgress(next);
  }

  async function runSync() {
    setSyncStatus("Sincronizando…");
    const result = await syncToken(token);
    await refreshPhotos();
    setSyncStatus(result.submitted ? "Enviado com sucesso." : result.uploaded > 0 ? `${result.uploaded} foto(s) sincronizada(s).` : "");
    if (result.submitted) setStep("done");
  }

  useEffect(() => {
    if (!online) return;
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (loadError) {
    return (
      <FieldShell>
        <Alert tone="danger">{loadError}</Alert>
      </FieldShell>
    );
  }

  if (!welcome || !progress) {
    return (
      <FieldShell>
        <p>Carregando…</p>
      </FieldShell>
    );
  }

  if (step === "welcome") {
    return (
      <FieldShell>
        <h1>{welcome.report.name}</h1>
        <p className="zp-eyebrow">{welcome.report.companies?.legal_name}</p>
        <Card style={{ marginTop: 16 }}>
          <p>Você foi convidado a preencher os dados de campo deste laudo de ancoragem. Preencha o endereço, cadastre cada ponto de ancoragem e tire as fotos necessárias — funciona mesmo sem internet.</p>
        </Card>
        {!online && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="warning">Você está offline. Pode continuar normalmente — os dados ficam salvos neste aparelho e enviados quando a conexão voltar.</Alert>
          </div>
        )}
        <Button style={{ marginTop: 24 }} onClick={() => setStep("site")}>
          Começar
        </Button>
      </FieldShell>
    );
  }

  if (step === "site") {
    return (
      <FieldShell>
        <h1>Dados do local</h1>
        <Card>
          <FormField label="Endereço">
            <input
              style={inputStyle}
              value={progress.siteAddress}
              onChange={(e) => persist({ ...progress, siteAddress: e.target.value })}
            />
          </FormField>
          <FormField label="Identificação da obra/planta">
            <input
              style={inputStyle}
              value={progress.siteIdentification}
              onChange={(e) => persist({ ...progress, siteIdentification: e.target.value })}
            />
          </FormField>
        </Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <Button variant="outline" onClick={() => setStep("welcome")}>
            Voltar
          </Button>
          <Button onClick={() => setStep(progress.anchorPoints.length > 0 ? 0 : "review")}>
            {progress.anchorPoints.length > 0 ? "Continuar" : "Adicionar primeiro ponto"}
          </Button>
        </div>
        {progress.anchorPoints.length === 0 && (
          <div style={{ marginTop: 12 }}>
            <Button
              variant="secondary"
              onClick={() => {
                const next = { ...progress, anchorPoints: [...progress.anchorPoints, emptyPoint(`Ponto ${progress.anchorPoints.length + 1}`)] };
                persist(next).then(() => setStep(0));
              }}
            >
              Adicionar ponto de ancoragem
            </Button>
          </div>
        )}
      </FieldShell>
    );
  }

  if (typeof step === "number") {
    const point = progress.anchorPoints[step];
    if (!point) {
      setStep("review");
      return null;
    }
    const pointPhotos = photos.filter((p) => p.anchorTag === point.tag);

    function updatePoint(patch: Partial<LocalAnchorPoint>) {
      const anchorPoints = progress!.anchorPoints.map((p, i) => (i === step ? { ...p, ...patch } : p));
      persist({ ...progress!, anchorPoints });
    }

    async function handlePhoto(file: File, isExtra: boolean) {
      const photo: LocalPhoto = {
        id: crypto.randomUUID(),
        token,
        anchorTag: point.tag,
        isExtra,
        blob: file,
        uploaded: false,
        createdAt: Date.now(),
      };
      await addPhoto(photo);
      await refreshPhotos();
      if (navigator.onLine) runSync();
    }

    return (
      <FieldShell>
        <h1>{point.tag}</h1>
        <Card>
          <FormField label="Acessório utilizado">
            <select style={inputStyle} value={point.accessoryId ?? ""} onChange={(e) => updatePoint({ accessoryId: e.target.value || null })}>
              <option value="">Selecione…</option>
              {welcome.accessories.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Modo de instalação">
            <select
              style={inputStyle}
              value={point.installationMode ?? ""}
              onChange={(e) => updatePoint({ installationMode: (e.target.value || null) as LocalAnchorPoint["installationMode"] })}
            >
              <option value="">Selecione…</option>
              <option value="quimico">Químico</option>
              <option value="mecanico">Mecânico</option>
            </select>
          </FormField>
          <FormField label="Profundidade do chumbador (mm)">
            <input
              style={inputStyle}
              type="number"
              value={point.anchorDepthMm ?? ""}
              onChange={(e) => updatePoint({ anchorDepthMm: e.target.value ? Number(e.target.value) : null })}
            />
          </FormField>
          <FormField label="Distância entre pontos (mm)">
            <input
              style={inputStyle}
              type="number"
              value={point.distanceBetweenPointsMm ?? ""}
              onChange={(e) => updatePoint({ distanceBetweenPointsMm: e.target.value ? Number(e.target.value) : null })}
            />
          </FormField>
          <FormField label="Instrumento de teste">
            <input style={inputStyle} value={point.testInstrument ?? ""} onChange={(e) => updatePoint({ testInstrument: e.target.value })} />
          </FormField>
          <FormField label="Carga aplicada (kN)">
            <input
              style={inputStyle}
              type="number"
              value={point.testAppliedLoadKn ?? ""}
              onChange={(e) => updatePoint({ testAppliedLoadKn: e.target.value ? Number(e.target.value) : null })}
            />
          </FormField>
          <FormField label="Tempo de teste (segundos)">
            <input
              style={inputStyle}
              type="number"
              value={point.testDurationSeconds ?? ""}
              onChange={(e) => updatePoint({ testDurationSeconds: e.target.value ? Number(e.target.value) : null })}
            />
          </FormField>
          <FormField label="Resultado do teste">
            <select
              style={inputStyle}
              value={point.testResult ?? ""}
              onChange={(e) => updatePoint({ testResult: (e.target.value || null) as LocalAnchorPoint["testResult"] })}
            >
              <option value="">Selecione…</option>
              <option value="aprovado">Aprovado</option>
              <option value="atencao">Atenção</option>
              <option value="reprovado">Reprovado</option>
            </select>
          </FormField>
          <FormField label="Observações">
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={point.notes ?? ""} onChange={(e) => updatePoint({ notes: e.target.value })} />
          </FormField>

          <FormField label="Fotos do ponto">
            <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0], false)} />
          </FormField>
          <FormField label="Foto extra (registro complementar)">
            <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0], true)} />
          </FormField>
          <PhotoGrid photos={pointPhotos} />
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <Button variant="outline" onClick={() => setStep(step === 0 ? "site" : step - 1)}>
            Voltar
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            {step === progress.anchorPoints.length - 1 && (
              <Button
                variant="secondary"
                onClick={() => {
                  const next = { ...progress, anchorPoints: [...progress.anchorPoints, emptyPoint(`Ponto ${progress.anchorPoints.length + 1}`)] };
                  persist(next).then(() => setStep(step + 1));
                }}
              >
                + Ponto
              </Button>
            )}
            <Button onClick={() => setStep(step === progress.anchorPoints.length - 1 ? "review" : step + 1)}>
              {step === progress.anchorPoints.length - 1 ? "Ir para revisão" : "Próximo ponto"}
            </Button>
          </div>
        </div>
      </FieldShell>
    );
  }

  if (step === "review") {
    return (
      <FieldShell>
        <h1>Revisão final</h1>
        <Card>
          <p><strong>{progress.siteAddress || "Endereço não informado"}</strong></p>
          <p className="zp-eyebrow">{progress.siteIdentification}</p>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {progress.anchorPoints.map((p, i) => (
            <Card key={p.tag} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} padding={16}>
              <div>
                <strong>{p.tag}</strong>
                <div className="zp-eyebrow">{photos.filter((ph) => ph.anchorTag === p.tag).length} foto(s)</div>
              </div>
              <Button variant="outline" onClick={() => setStep(i)}>
                Editar
              </Button>
            </Card>
          ))}
        </div>
        {syncStatus && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="info">{syncStatus}</Alert>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <Button variant="outline" onClick={() => setStep(Math.max(0, progress.anchorPoints.length - 1))}>
            Voltar
          </Button>
          <Button
            onClick={async () => {
              await persist({ ...progress, pendingSubmit: true });
              await runSync();
            }}
          >
            {online ? "Enviar laudo" : "Salvar e enviar quando conectar"}
          </Button>
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell>
      <h1>Enviado!</h1>
      <Alert tone="success">Os dados de campo foram enviados e entraram na fila de revisão de engenharia. Obrigado.</Alert>
    </FieldShell>
  );
}

function PhotoGrid({ photos }: { photos: LocalPhoto[] }) {
  const urls = useMemo(() => photos.map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob), uploaded: p.uploaded })), [photos]);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {urls.map((p) => (
        <div key={p.id} style={{ position: "relative" }}>
          <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 4, border: "1px solid var(--color-gray-light)" }} />
          <span
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              fontSize: 9,
              padding: "1px 4px",
              borderRadius: 3,
              background: p.uploaded ? "var(--color-success)" : "var(--color-gray)",
              color: "#fff",
            }}
          >
            {p.uploaded ? "enviado" : "local"}
          </span>
        </div>
      ))}
    </div>
  );
}

function FieldShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-off-white)", padding: "24px 16px", maxWidth: 480, margin: "0 auto" }}>
      {children}
    </div>
  );
}
