import "dotenv/config";
import { supabaseAdmin } from "../lib/supabase.js";

// Dev-only seed: creates a Zoppi admin auth user + profile, a demo subscriber
// company with an active Ancoragem subscription, and a company_admin user.
// Run with: npm run seed --workspace apps/api
// Requires SUPABASE_SERVICE_ROLE_KEY set (never expose this key client-side).
async function upsertAuthUser(email: string, password: string) {
  const { data: existing, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const found = existing.users.find((u) => u.email === email);
  if (found) return found;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user;
}

async function main() {
  const zoppiAdminAuth = await upsertAuthUser("admin@zoppi.com.br", "ZoppiAdmin123!");
  const { error: adminProfileError } = await supabaseAdmin.from("users").upsert(
    {
      id: zoppiAdminAuth.id,
      role: "zoppi_admin",
      full_name: "Zoppi Admin",
      email: "admin@zoppi.com.br",
    },
    { onConflict: "id" },
  );
  if (adminProfileError) throw adminProfileError;

  const engineerAuth = await upsertAuthUser("engenheiro@zoppi.com.br", "ZoppiEng123!");
  const { error: engineerProfileError } = await supabaseAdmin.from("users").upsert(
    {
      id: engineerAuth.id,
      role: "zoppi_engineer",
      full_name: "Eng. Responsável Demo",
      email: "engenheiro@zoppi.com.br",
      crea_number: "CREA-SP 123456789",
    },
    { onConflict: "id" },
  );
  if (engineerProfileError) throw engineerProfileError;

  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .upsert(
      {
        legal_name: "Empresa Demo Ltda",
        cnpj: "00000000000191",
        kind: "facility_owner",
        contact_name: "Contato Demo",
        contact_email: "empresa@demo.com.br",
      },
      { onConflict: "cnpj" },
    )
    .select()
    .single();
  if (companyError || !company) throw companyError ?? new Error("Demo company was not created");

  const companyAdminAuth = await upsertAuthUser("empresa@demo.com.br", "EmpresaDemo123!");
  const { error: companyProfileError } = await supabaseAdmin.from("users").upsert(
    {
      id: companyAdminAuth.id,
      role: "company_admin",
      full_name: "Admin Empresa Demo",
      email: "empresa@demo.com.br",
      company_id: company.id,
    },
    { onConflict: "id" },
  );
  if (companyProfileError) throw companyProfileError;

  const { data: moduleRow, error: moduleError } = await supabaseAdmin.from("modules").select("id").eq("slug", "ancoragem").single();
  if (moduleError || !moduleRow) throw moduleError ?? new Error("Ancoragem module was not found");
  const { error: subscriptionError } = await supabaseAdmin.from("module_subscriptions").upsert(
    {
      company_id: company.id,
      module_id: moduleRow.id,
      status: "active",
      plan_code: "standard",
      monthly_amount_cents: 29900,
      current_period_start: new Date().toISOString(),
    },
    { onConflict: "company_id,module_id" },
  );
  if (subscriptionError) throw subscriptionError;

  console.log("Seed complete.");
  console.log("Zoppi Admin: admin@zoppi.com.br / ZoppiAdmin123!");
  console.log("Zoppi Engenheiro: engenheiro@zoppi.com.br / ZoppiEng123!");
  console.log("Empresa Demo Admin: empresa@demo.com.br / EmpresaDemo123!");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
