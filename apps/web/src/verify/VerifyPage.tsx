import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../lib/api.js";
import { Card } from "../shared/components/Card.js";
import { Alert } from "../shared/components/Alert.js";

interface VerifyResult {
  valid: boolean;
  report?: { name: string; reportNumber: string; issuedAt: string; validUntil: string; company: string };
  signature?: { engineerName: string; engineerCrea: string; signedAt: string } | null;
}

export function VerifyPage() {
  const { reportId = "" } = useParams();
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    publicApi
      .get(`/verify/${reportId}`)
      .then(setResult)
      .catch(() => setResult({ valid: false }));
  }, [reportId]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-navy-dark)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Card style={{ width: 420 }} padding={32}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>ZOPPI</span>
        </div>
        {!result ? (
          <p>Verificando…</p>
        ) : result.valid && result.report ? (
          <>
            <Alert tone="success">Documento autêntico</Alert>
            <div style={{ marginTop: 16 }}>
              <p><strong>{result.report.name}</strong></p>
              <p className="zp-eyebrow">Laudo {result.report.reportNumber}</p>
              <p>Empresa: {result.report.company}</p>
              <p>Emissão: {new Date(result.report.issuedAt).toLocaleDateString("pt-BR")}</p>
              <p>Validade: {new Date(result.report.validUntil).toLocaleDateString("pt-BR")}</p>
              {result.signature && (
                <>
                  <hr style={{ margin: "16px 0", borderColor: "var(--color-gray-light)" }} />
                  <p>Assinado por: {result.signature.engineerName}</p>
                  <p>CREA: {result.signature.engineerCrea}</p>
                  <p>Data da assinatura: {new Date(result.signature.signedAt).toLocaleString("pt-BR")}</p>
                </>
              )}
            </div>
          </>
        ) : (
          <Alert tone="danger">Documento não encontrado ou ainda não assinado.</Alert>
        )}
      </Card>
    </div>
  );
}
