import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ANCHOR_ISSUE_TAGS, SYSTEM_PURPOSE_OPTIONS, type FieldOptionKey } from "@zoppi/shared";
import { publicApi } from "../lib/api.js";
import { Button } from "../shared/components/Button.js";
import { Card } from "../shared/components/Card.js";
import { FormField, inputStyle } from "../shared/components/FormField.js";
import { Alert } from "../shared/components/Alert.js";
import { Skeleton } from "../shared/components/Skeleton.js";
import { OptionPicker, type PickerOption } from "../shared/components/OptionPicker.js";
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
  type LocalPhotoKind,
  type LocalProgress,
} from "./offline/db.js";
import { syncToken } from "./offline/sync.js";

interface WelcomeData {
  report: { name: string; site_address: string | null; site_identification: string | null; companies?: { legal_name: string } };
  accessories: { id: string; name: string; image_url: string | null }[];
  tips: { slug: string; title: string; summary: string | null; step_context: string | null }[];
  fieldOptions: Record<FieldOptionKey, { value: string; label: string; image_url: string | null }[]>;
}

function toPickerOptions(items: { value: string; label: string; image_url: string | null }[] | undefined): PickerOption[] {
  return (items ?? []).map((o) => ({ value: o.value, label: o.label, imageUrl: o.image_url }));
}

function emptyPoint(tag: string): LocalAnchorPoint {
  return {
    tag,
    accessoryId: null,
    installationMode: null,
    deviceType: null,
    anchorDepthMm: null,
    distanceBetweenPointsMm: null,
    testInstrument: null,
    testReferenceLoadKgf: null,
    testAppliedLoadKgf: null,
    testDurationSeconds: null,
    testLoadDirection: null,
    testResult: null,
    fixationMaterialReference: null,
    systemType: null,
    systemPurpose: null,
    capacityUsers: null,
    supportStructure: null,
    fixationModeDetail: null,
    environmentCondition: null,
    notes: null,
    issueTags: [],
  };
}

type Step = "welcome" | "equipment" | number | "review" | "done";

function stepIndex(step: Step, totalPoints: number): number {
  if (step === "welcome") return 0;
  if (step === "equipment") return 1;
  if (step === "review" || step === "done") return totalPoints + 2;
  return step + 2;
}

export function FieldWizard() {
  const { token = "" } = useParams();
  const online = useOnlineStatus();

  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LocalProgress | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [step, setStep] = useState<Step>("welcome");
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pointError, setPointError] = useState<string | null>(null);

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
    setSubmitError(null);
    const result = await syncToken(token);
    await refreshPhotos();
    setSyncStatus(result.submitted ? "Enviado com sucesso." : result.uploaded > 0 ? `${result.uploaded} foto(s) sincronizada(s).` : "");
    if (result.submitError) setSubmitError(result.submitError);
    if (result.submitted) setStep("done");
  }

  useEffect(() => {
    if (!online) return;
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    setPointError(null);
  }, [step]);

  function addPoint() {
    if (!progress) return;
    const next = { ...progress, anchorPoints: [...progress.anchorPoints, emptyPoint(`Ponto ${progress.anchorPoints.length + 1}`)] };
    persist(next).then(() => setStep(next.anchorPoints.length - 1));
  }

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
        <Skeleton height={8} width="100%" radius={4} style={{ marginBottom: 24 }} />
        <Skeleton height={26} width="70%" style={{ marginBottom: 8 }} />
        <Skeleton height={12} width="40%" style={{ marginBottom: 20 }} />
        <Card padding={20}>
          <Skeleton height={13} width="30%" style={{ marginBottom: 12 }} />
          <Skeleton height={14} style={{ marginBottom: 8 }} />
          <Skeleton height={14} width="80%" />
        </Card>
      </FieldShell>
    );
  }

  const totalSteps = progress.anchorPoints.length + 3; // welcome + equipment + points + review
  const currentIndex = stepIndex(step, progress.anchorPoints.length);

  if (step === "welcome") {
    return (
      <FieldShell>
        <StepProgress current={currentIndex} total={totalSteps} label="Boas-vindas" />
        <h1>{welcome.report.name}</h1>
        <p className="zp-eyebrow">{welcome.report.companies?.legal_name}</p>
        <Card padding={20} style={{ marginTop: 16 }}>
          {(welcome.report.site_address || welcome.report.site_identification) && (
            <div style={{ marginBottom: 12 }}>
              <div className="zp-eyebrow">Local</div>
              {welcome.report.site_identification && <p style={{ margin: "2px 0", fontWeight: 600 }}>{welcome.report.site_identification}</p>}
              {welcome.report.site_address && <p style={{ margin: "2px 0" }}>{welcome.report.site_address}</p>}
            </div>
          )}
          <p style={{ margin: 0 }}>
            Você foi convidado a preencher os dados de campo deste laudo de ancoragem. Para cada ponto, tire as fotos pedidas e responda algumas
            perguntas rápidas — como em um processo de foto de sinistro de seguro. Funciona mesmo sem internet.
          </p>
        </Card>
        {!online && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="warning">Você está offline. Pode continuar normalmente — os dados ficam salvos neste aparelho e enviados quando a conexão voltar.</Alert>
          </div>
        )}
        <div style={{ height: 80 }} />
        <BottomBar>
          <Button style={{ width: "100%" }} onClick={() => setStep("equipment")}>
            Começar
          </Button>
        </BottomBar>
      </FieldShell>
    );
  }

  if (step === "equipment") {
    function updateProgress(patch: Partial<LocalProgress>) {
      persist({ ...progress!, ...patch });
    }

    return (
      <FieldShell>
        <StepProgress current={currentIndex} total={totalSteps} label="Equipamento e responsável" />
        <h1>Antes de começar</h1>
        <p className="zp-eyebrow" style={{ marginBottom: 12 }}>
          Esses dados aparecem uma única vez no laudo — não é preciso repetir por ponto.
        </p>

        <SectionLabel n={1} title="Quem está preenchendo" />
        <Card padding={20} style={{ marginTop: 8 }}>
          <FormField label="Seu nome">
            <input style={inputStyle} value={progress.fieldExecutorName ?? ""} onChange={(e) => updateProgress({ fieldExecutorName: e.target.value })} />
          </FormField>
          <FormField label="Seu cargo/função">
            <input style={inputStyle} value={progress.fieldExecutorRole ?? ""} onChange={(e) => updateProgress({ fieldExecutorRole: e.target.value })} />
          </FormField>
        </Card>

        <SectionLabel n={2} title="Acompanhante do cliente (se houver)" />
        <Card padding={20} style={{ marginTop: 8 }}>
          <FormField label="Nome do acompanhante">
            <input style={inputStyle} value={progress.accompanyingClientName ?? ""} onChange={(e) => updateProgress({ accompanyingClientName: e.target.value })} />
          </FormField>
          <FormField label="Função do acompanhante">
            <input style={inputStyle} value={progress.accompanyingClientRole ?? ""} onChange={(e) => updateProgress({ accompanyingClientRole: e.target.value })} />
          </FormField>
        </Card>

        <SectionLabel n={3} title="Instrumento de teste (dinamômetro)" />
        <Card padding={20} style={{ marginTop: 8 }}>
          <FormField label="Fabricante">
            <input
              style={inputStyle}
              value={progress.testEquipmentManufacturer ?? ""}
              onChange={(e) => updateProgress({ testEquipmentManufacturer: e.target.value })}
            />
          </FormField>
          <FormField label="Modelo">
            <input style={inputStyle} value={progress.testEquipmentModel ?? ""} onChange={(e) => updateProgress({ testEquipmentModel: e.target.value })} />
          </FormField>
          <FormField label="Número de série">
            <input style={inputStyle} value={progress.testEquipmentSerial ?? ""} onChange={(e) => updateProgress({ testEquipmentSerial: e.target.value })} />
          </FormField>
          <FormField label="Capacidade do instrumento (kgf)">
            <input
              style={inputStyle}
              type="number"
              inputMode="decimal"
              value={progress.testEquipmentCapacityKgf ?? ""}
              onChange={(e) => updateProgress({ testEquipmentCapacityKgf: e.target.value ? Number(e.target.value) : null })}
            />
          </FormField>
        </Card>

        <div style={{ height: 96 }} />

        <BottomBar>
          <Button style={{ width: "100%" }} onClick={() => (progress.anchorPoints.length > 0 ? setStep(0) : addPoint())}>
            Continuar
          </Button>
          <div style={{ marginTop: 8 }}>
            <TextButton onClick={() => setStep("welcome")}>← Voltar</TextButton>
          </div>
        </BottomBar>
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
    const tip = welcome.tips.find((t) => t.step_context === "anchor_point_photos");
    const isLastPoint = step === progress.anchorPoints.length - 1;

    function updatePoint(patch: Partial<LocalAnchorPoint>) {
      const anchorPoints = progress!.anchorPoints.map((p, i) => (i === step ? { ...p, ...patch } : p));
      persist({ ...progress!, anchorPoints });
    }

    function toggleIssueTag(value: string) {
      const has = point.issueTags.includes(value);
      updatePoint({ issueTags: has ? point.issueTags.filter((t) => t !== value) : [...point.issueTags, value] });
    }

    function goToNextStep() {
      if (!point.deviceType || point.testAppliedLoadKgf == null || point.testDurationSeconds == null) {
        setPointError("Preencha tipo de dispositivo, carga aplicada e tempo de teste antes de continuar.");
        return;
      }
      setPointError(null);
      setStep(isLastPoint ? "review" : (step as number) + 1);
    }

    async function handlePhoto(file: File, kind: LocalPhotoKind) {
      const photo: LocalPhoto = {
        id: crypto.randomUUID(),
        token,
        anchorTag: point.tag,
        kind,
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
        <StepProgress current={currentIndex} total={totalSteps} label={`Ponto ${step + 1} de ${progress.anchorPoints.length}`} />
        <h1>{point.tag}</h1>

        {tip && (
          <div style={{ margin: "12px 0" }}>
            <Alert tone="info">{tip.summary ?? tip.title}</Alert>
          </div>
        )}

        <SectionLabel n={1} title="Fotos" />
        <PhotoSlot
          title="Foto do ponto de ancoragem"
          hint="Enquadre o olhal/ponto por inteiro, com boa iluminação."
          modelSrc="/field-examples/model-anchor-point.png"
          photos={pointPhotos.filter((p) => p.kind === "point")}
          onCapture={(file) => handlePhoto(file, "point")}
        />
        <PhotoSlot
          title="Foto do teste (manômetro + tempo)"
          hint="Mostre o mostrador do dinamômetro e o cronômetro/celular na mesma foto, se possível."
          modelSrc="/field-examples/model-test-gauge.jpeg"
          photos={pointPhotos.filter((p) => p.kind === "test")}
          onCapture={(file) => handlePhoto(file, "test")}
        />
        <PhotoSlot
          title="Foto extra (opcional)"
          hint="Qualquer registro complementar relevante."
          photos={pointPhotos.filter((p) => p.kind === "extra")}
          onCapture={(file) => handlePhoto(file, "extra")}
        />

        <SectionLabel n={2} title="Classificação" />
        <Card padding={20} style={{ marginTop: 8 }}>
          <div className="zp-eyebrow" style={{ marginBottom: 8 }}>
            Modo de instalação
          </div>
          <SegmentedControl
            options={[
              { value: "quimico", label: "Químico" },
              { value: "mecanico", label: "Mecânico" },
            ]}
            value={point.installationMode}
            onChange={(v) => updatePoint({ installationMode: v as LocalAnchorPoint["installationMode"] })}
          />

          <div className="zp-eyebrow" style={{ margin: "18px 0 8px" }}>
            Tipo de dispositivo (NBR 16325-1) *
          </div>
          <OptionPicker
            options={toPickerOptions(welcome.fieldOptions.device_type)}
            value={point.deviceType}
            onChange={(v) => updatePoint({ deviceType: v })}
          />

          <div className="zp-eyebrow" style={{ margin: "18px 0 8px" }}>
            Descrição do sistema neste ponto
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
                Tipo do sistema
              </div>
              <OptionPicker
                options={toPickerOptions(welcome.fieldOptions.system_type)}
                value={point.systemType}
                onChange={(v) => updatePoint({ systemType: v })}
              />
            </div>
            <SelectOrOther
              label="Finalidade"
              options={SYSTEM_PURPOSE_OPTIONS}
              value={point.systemPurpose}
              onChange={(v) => updatePoint({ systemPurpose: v })}
            />
            <div>
              <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
                Capacidade / usuários
              </div>
              <input
                style={inputStyle}
                placeholder="Ex.: 1 usuário — conforme projeto/fabricante"
                value={point.capacityUsers ?? ""}
                onChange={(e) => updatePoint({ capacityUsers: e.target.value || null })}
              />
            </div>
            <div>
              <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
                Estrutura suporte
              </div>
              <OptionPicker
                options={toPickerOptions(welcome.fieldOptions.support_structure)}
                value={point.supportStructure}
                onChange={(v) => updatePoint({ supportStructure: v })}
              />
            </div>
            <div>
              <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
                Modo de fixação (detalhe)
              </div>
              <input
                style={inputStyle}
                placeholder="Ex.: Químico com resina epóxi / mecânico tipo expansão"
                value={point.fixationModeDetail ?? ""}
                onChange={(e) => updatePoint({ fixationModeDetail: e.target.value || null })}
              />
            </div>
            <div>
              <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
                Condição ambiental
              </div>
              <OptionPicker
                options={toPickerOptions(welcome.fieldOptions.environment_condition)}
                value={point.environmentCondition}
                onChange={(v) => updatePoint({ environmentCondition: v })}
              />
            </div>
          </div>

          <div className="zp-eyebrow" style={{ margin: "18px 0 8px" }}>
            Carga aplicada no teste *
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              type="number"
              inputMode="decimal"
              placeholder="Ex.: 1500"
              value={point.testAppliedLoadKgf ?? ""}
              onChange={(e) => updatePoint({ testAppliedLoadKgf: e.target.value ? Number(e.target.value) : null })}
            />
            <span style={{ alignSelf: "center", fontWeight: 600, color: "var(--color-gray)" }}>kgf</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--color-gray)", marginTop: 4 }}>Carga mínima exigida pela NR35/NBR 16325-1: 1.500 kgf.</div>

          <div className="zp-eyebrow" style={{ margin: "18px 0 8px" }}>
            Tempo de teste (segundos) *
          </div>
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            value={point.testDurationSeconds ?? ""}
            onChange={(e) => updatePoint({ testDurationSeconds: e.target.value ? Number(e.target.value) : null })}
          />

          <div className="zp-eyebrow" style={{ margin: "18px 0 8px" }}>
            Resultado do teste (sua sugestão — o engenheiro confirma na revisão)
          </div>
          <SegmentedControl
            options={[
              { value: "aprovado", label: "Aprovado", tone: "success" },
              { value: "atencao", label: "Atenção", tone: "warning" },
              { value: "reprovado", label: "Reprovado", tone: "danger" },
            ]}
            value={point.testResult}
            onChange={(v) => updatePoint({ testResult: v as LocalAnchorPoint["testResult"] })}
          />

          <div className="zp-eyebrow" style={{ margin: "18px 0 8px" }}>
            Ocorrências identificadas (se houver)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ANCHOR_ISSUE_TAGS.map((tag) => (
              <label key={tag.value} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={point.issueTags.includes(tag.value)}
                  onChange={() => toggleIssueTag(tag.value)}
                  style={{ width: 20, height: 20, flexShrink: 0 }}
                />
                {tag.label}
              </label>
            ))}
          </div>
        </Card>

        <SectionLabel n={3} title="Descrição" />
        <Card padding={20} style={{ marginTop: 8 }}>
          <FormField label="Descreva a situação deste ponto">
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              placeholder="Observações livres sobre o ponto…"
              value={point.notes ?? ""}
              onChange={(e) => updatePoint({ notes: e.target.value })}
            />
          </FormField>
        </Card>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, padding: "8px 0" }}>Medições adicionais (opcional)</summary>
          <Card padding={20} style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 16 }}>
              <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
                Acessório utilizado
              </div>
              <OptionPicker
                options={welcome.accessories.map((a) => ({ value: a.id, label: a.name, imageUrl: a.image_url }))}
                value={point.accessoryId}
                onChange={(v) => updatePoint({ accessoryId: v })}
                allowOther={false}
              />
            </div>
            <FormField label="Profundidade do chumbador (mm)">
              <input
                style={inputStyle}
                type="number"
                inputMode="decimal"
                value={point.anchorDepthMm ?? ""}
                onChange={(e) => updatePoint({ anchorDepthMm: e.target.value ? Number(e.target.value) : null })}
              />
            </FormField>
            <FormField label="Distância entre pontos (mm)">
              <input
                style={inputStyle}
                type="number"
                inputMode="decimal"
                value={point.distanceBetweenPointsMm ?? ""}
                onChange={(e) => updatePoint({ distanceBetweenPointsMm: e.target.value ? Number(e.target.value) : null })}
              />
            </FormField>
            <FormField label="Material / referência da fixação">
              <input
                style={inputStyle}
                value={point.fixationMaterialReference ?? ""}
                onChange={(e) => updatePoint({ fixationMaterialReference: e.target.value })}
              />
            </FormField>
            <FormField label="Direção da carga aplicada">
              <input
                style={inputStyle}
                placeholder="Ex.: Tração"
                value={point.testLoadDirection ?? ""}
                onChange={(e) => updatePoint({ testLoadDirection: e.target.value })}
              />
            </FormField>
          </Card>
        </details>

        {pointError && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="danger">{pointError}</Alert>
          </div>
        )}

        <div style={{ height: 96 }} />

        <BottomBar>
          <Button style={{ width: "100%" }} onClick={goToNextStep}>
            {isLastPoint ? "Ir para revisão" : "Próximo ponto"}
          </Button>
          <Button variant="secondary" style={{ width: "100%", marginTop: 10 }} onClick={addPoint}>
            + Adicionar outro ponto de ancoragem
          </Button>
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <TextButton onClick={() => setStep(step === 0 ? "equipment" : step - 1)}>← Voltar</TextButton>
          </div>
        </BottomBar>
      </FieldShell>
    );
  }

  if (step === "review") {
    return (
      <FieldShell>
        <StepProgress current={currentIndex} total={totalSteps} label="Revisão final" />
        <h1>Revisão final</h1>
        <p className="zp-eyebrow" style={{ marginBottom: 12 }}>
          Confira os dados antes de enviar. Toque em "Editar" para corrigir algo.
        </p>

        <Card padding={16} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div>
            <strong>Equipamento e responsável</strong>
            <div className="zp-eyebrow">
              {progress.fieldExecutorName || "Executante não informado"}
              {progress.testEquipmentManufacturer ? ` · ${progress.testEquipmentManufacturer} ${progress.testEquipmentModel ?? ""}`.trim() : ""}
            </div>
          </div>
          <Button variant="outline" onClick={() => setStep("equipment")}>
            Editar
          </Button>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {progress.anchorPoints.map((p, i) => {
            const count = photos.filter((ph) => ph.anchorTag === p.tag).length;
            return (
              <Card key={p.tag} padding={16} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <strong>{p.tag}</strong>
                  <div className="zp-eyebrow">
                    {count} foto(s){p.testResult ? ` · ${p.testResult}` : ""}
                  </div>
                </div>
                <Button variant="outline" onClick={() => setStep(i)}>
                  Editar
                </Button>
              </Card>
            );
          })}
        </div>

        {submitError && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="danger">Não foi possível enviar: {submitError} Seus dados continuam salvos neste aparelho — tente novamente.</Alert>
          </div>
        )}
        {!submitError && syncStatus && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="info">{syncStatus}</Alert>
          </div>
        )}

        <div style={{ height: 96 }} />

        <BottomBar>
          <Button
            style={{ width: "100%", padding: "16px 26px", fontSize: "1.02rem", background: "var(--color-success)", borderColor: "var(--color-success)" }}
            onClick={async () => {
              await persist({ ...progress, pendingSubmit: true });
              await runSync();
            }}
          >
            {online ? "✓ Enviar laudo" : "Salvar e enviar quando conectar"}
          </Button>
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <TextButton onClick={() => setStep(Math.max(0, progress.anchorPoints.length - 1))}>← Voltar</TextButton>
          </div>
        </BottomBar>
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

function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="zp-eyebrow">{label}</span>
        <span className="zp-eyebrow">
          {current}/{total}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--color-gray-light)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-orange)", transition: "width 0.2s ease" }} />
      </div>
    </div>
  );
}

function SectionLabel({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 4 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--color-navy)",
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{title}</span>
    </div>
  );
}

function PhotoSlot({
  title,
  hint,
  modelSrc,
  photos,
  onCapture,
}: {
  title: string;
  hint?: string;
  modelSrc?: string;
  photos: LocalPhoto[];
  onCapture: (file: File) => void;
}) {
  const inputId = useMemo(() => `photo-${Math.random().toString(36).slice(2)}`, []);
  const thumbs = useMemo(() => photos.map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob), uploaded: p.uploaded })), [photos]);

  return (
    <Card padding={16} style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {modelSrc && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <img src={modelSrc} alt="Exemplo" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, border: "1px solid var(--color-gray-light)" }} />
            <div style={{ fontSize: "0.6rem", color: "var(--color-gray)", marginTop: 2 }}>modelo</div>
          </div>
        )}
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{title}</div>
          {hint && <div style={{ fontSize: "0.78rem", color: "var(--color-gray)", marginTop: 2 }}>{hint}</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {thumbs.map((t) => (
          <div key={t.id} style={{ position: "relative" }}>
            <img src={t.url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, border: "1px solid var(--color-gray-light)" }} />
            <span
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                fontSize: 8,
                padding: "1px 3px",
                borderRadius: 3,
                background: t.uploaded ? "var(--color-success)" : "var(--color-gray)",
                color: "#fff",
              }}
            >
              {t.uploaded ? "ok" : "local"}
            </span>
          </div>
        ))}
        <label
          htmlFor={inputId}
          style={{
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: "2px dashed var(--color-gray-light)",
            color: "var(--color-navy)",
            fontSize: "1.5rem",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          +
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) onCapture(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
    </Card>
  );
}

const OTHER_OPTION = "__other__";

// A <select> of curated, norm-grounded suggestions with an "Outro" option
// that reveals a free-text input — the value is always stored as plain text
// (anchor_points columns aren't enums), this is only UI sugar to keep field
// entries consistent without blocking edge cases.
function SelectOrOther({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  // Custom mode is tracked explicitly rather than inferred from `value` — an
  // empty custom value (right after picking "Outro", before typing) would
  // otherwise be indistinguishable from "nothing selected".
  const [customMode, setCustomMode] = useState(() => value != null && value !== "" && !options.includes(value));
  return (
    <div>
      <div className="zp-eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <select
        style={inputStyle}
        value={customMode ? OTHER_OPTION : value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER_OPTION) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(v || null);
          }
        }}
      >
        <option value="">Selecione…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value={OTHER_OPTION}>Outro (especificar)</option>
      </select>
      {customMode && (
        <input
          style={{ ...inputStyle, marginTop: 8 }}
          placeholder="Especifique…"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; tone?: "success" | "warning" | "danger" }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  const toneColor = { success: "var(--color-success)", warning: "var(--color-warning)", danger: "var(--color-danger)" } as const;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const active = value === opt.value;
        const color = opt.tone ? toneColor[opt.tone] : "var(--color-navy)";
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: "1 1 auto",
              minWidth: 90,
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              border: `2px solid ${active ? color : "var(--color-gray-light)"}`,
              background: active ? color : "transparent",
              color: active ? "#fff" : "var(--color-text)",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "var(--color-navy)",
        fontWeight: 600,
        fontSize: "0.85rem",
        padding: "8px 4px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Fixed to the bottom of the viewport so the primary action is always
// reachable without scrolling — the page content reserves space for it via
// the spacer div rendered just before <BottomBar>.
function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "var(--color-white)",
        borderTop: "1px solid var(--color-gray-light)",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function FieldShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-off-white)", padding: "20px 16px", maxWidth: 480, margin: "0 auto", boxSizing: "border-box" }}>
      {children}
    </div>
  );
}
