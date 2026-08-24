import { Router } from "express";
import { isValidCnpj, normalizeCnpj, type CnpjLookupResult } from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const companiesRouter = Router();

companiesRouter.use(requireAuth);

function withLogoUrl<T extends { logo_path: string | null }>(item: T): T & { logo_url: string | null } {
  const logo_url = item.logo_path ? supabaseAdmin.storage.from("company-logos").getPublicUrl(item.logo_path).data.publicUrl : null;
  return { ...item, logo_url };
}

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ");
}

companiesRouter.get("/", requireRole("zoppi_admin", "zoppi_engineer"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("companies").select("*").order("legal_name");
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(withLogoUrl));
});

companiesRouter.get("/lookup/cnpj/:cnpj", async (req, res) => {
  const cnpj = normalizeCnpj(req.params.cnpj);
  if (!isValidCnpj(cnpj)) return res.status(400).json({ error: "CNPJ inválido." });

  let response: globalThis.Response | null = null;
  try {
    response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json", "User-Agent": "Zoppi-Seguranca/1.0" },
    });
  } catch {}

  if (response?.ok) {
    const data = (await response.json()) as Record<string, string | null>;
    const result: CnpjLookupResult = {
      cnpj,
      legalName: data.razao_social ?? "",
      tradeName: data.nome_fantasia || null,
      address: joinAddress([data.logradouro, data.numero, data.complemento, data.bairro, data.municipio, data.uf, data.cep]),
      street: data.logradouro || null,
      number: data.numero || null,
      complement: data.complemento || null,
      district: data.bairro || null,
      city: data.municipio || null,
      state: data.uf || null,
      zip: data.cep ? data.cep.replace(/\D/g, "") : null,
      phone: data.ddd_telefone_1 || null,
      email: data.email || null,
    };
    return res.json(result);
  }

  console.warn(`[CNPJ lookup] BrasilAPI ${response ? `returned HTTP ${response.status}` : "was unavailable"}; trying CNPJ.ws.`);
  let fallbackResponse: globalThis.Response;
  try {
    fallbackResponse = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json", "User-Agent": "Zoppi-Seguranca/1.0" },
    });
  } catch {
    return res.status(503).json({ error: "A consulta de CNPJ está indisponível no momento." });
  }
  if (fallbackResponse.status === 404) return res.status(404).json({ error: "CNPJ não encontrado." });
  if (!fallbackResponse.ok) return res.status(502).json({ error: "Não foi possível consultar esse CNPJ." });

  const fallbackData = (await fallbackResponse.json()) as {
    razao_social?: string;
    estabelecimento?: {
      nome_fantasia?: string | null;
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cep?: string | null;
      ddd1?: string | null;
      telefone1?: string | null;
      email?: string | null;
      cidade?: { nome?: string | null } | null;
      estado?: { sigla?: string | null } | null;
    };
  };
  const establishment = fallbackData.estabelecimento;
  const city = establishment?.cidade?.nome || null;
  const state = establishment?.estado?.sigla || null;
  const phone = [establishment?.ddd1, establishment?.telefone1].filter(Boolean).join("") || null;
  const result: CnpjLookupResult = {
    cnpj,
    legalName: fallbackData.razao_social ?? "",
    tradeName: establishment?.nome_fantasia || null,
    address: joinAddress([
      establishment?.logradouro,
      establishment?.numero,
      establishment?.complemento,
      establishment?.bairro,
      city,
      state,
      establishment?.cep,
    ]),
    street: establishment?.logradouro || null,
    number: establishment?.numero || null,
    complement: establishment?.complemento || null,
    district: establishment?.bairro || null,
    city,
    state,
    zip: establishment?.cep ? establishment.cep.replace(/\D/g, "") : null,
    phone,
    email: establishment?.email || null,
  };
  return res.json(result);
});

companiesRouter.get("/:id", async (req, res) => {
  if (req.user!.role === "company_admin" || req.user!.role === "company_operational") {
    if (req.user!.companyId !== req.params.id) return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin.from("companies").select("*").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ error: "Company not found" });
  res.json(withLogoUrl(data));
});

companiesRouter.post("/", requireRole("zoppi_admin"), async (req, res) => {
  const body = { ...req.body, cnpj: normalizeCnpj(String(req.body?.cnpj ?? "")) };
  if (!isValidCnpj(body.cnpj)) return res.status(400).json({ error: "CNPJ inválido." });
  const { data, error } = await supabaseAdmin.from("companies").insert(body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(withLogoUrl(data));
});

companiesRouter.patch("/:id", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  if (req.user!.role === "company_admin" && req.user!.companyId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const body = { ...req.body };
  if (body.cnpj !== undefined) {
    body.cnpj = normalizeCnpj(String(body.cnpj));
    if (!isValidCnpj(body.cnpj)) return res.status(400).json({ error: "CNPJ inválido." });
  }
  const { data, error } = await supabaseAdmin
    .from("companies")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(withLogoUrl(data));
});

// Returns a signed upload URL for the company's PDF logo; the client uploads
// directly to Supabase Storage, then PATCHes { logo_path: path } to attach it
// (same pattern as accessory-catalog images — see accessories/routes.ts).
companiesRouter.post("/:id/logo-upload-url", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  if (req.user!.role === "company_admin" && req.user!.companyId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const ext = (req.body?.ext as string) ?? "png";
  const path = `${req.params.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("company-logos").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});
