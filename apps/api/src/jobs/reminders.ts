import { supabaseAdmin } from "../lib/supabase.js";

// Scans reports approaching their valid_until date and enqueues a
// notification job for each configured lead time (default 30 and 7 days —
// spec section 4.7), de-duplicating against notifications_log so the same
// report+lead-time pair is only notified once.
export async function runRevalidationReminders() {
  const { data: config } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "report_reminder_days_before")
    .single();
  const leadDays: number[] = (config?.value as number[]) ?? [30, 7];

  const { data: reports } = await supabaseAdmin
    .from("reports")
    .select("id, name, valid_until, company_id, companies(contact_email)")
    .not("valid_until", "is", null)
    .in("status", ["signed", "delivered"]);

  const now = Date.now();

  for (const report of reports ?? []) {
    if (!report.valid_until) continue;
    const daysLeft = Math.ceil((new Date(report.valid_until).getTime() - now) / (1000 * 60 * 60 * 24));
    if (!leadDays.includes(daysLeft)) continue;

    const eventType = `revalidation_reminder_${daysLeft}d`;
    const { data: alreadySent } = await supabaseAdmin
      .from("notifications_log")
      .select("id")
      .eq("report_id", report.id)
      .eq("event_type", eventType)
      .maybeSingle();
    if (alreadySent) continue;

    const recipient = (report as any).companies?.contact_email;
    if (!recipient) continue;

    await supabaseAdmin.from("notification_jobs").insert({
      report_id: report.id,
      channel: "email",
      event_type: eventType,
      recipient,
      payload: {
        subject: `Zoppi — laudo "${report.name}" vence em ${daysLeft} dias`,
        body: `<p>O laudo <strong>${report.name}</strong> vence em ${daysLeft} dias (${new Date(report.valid_until).toLocaleDateString("pt-BR")}). Solicite uma revalidação com antecedência.</p>`,
      },
    });
    await supabaseAdmin.from("notifications_log").insert({
      report_id: report.id,
      channel: "email",
      event_type: eventType,
      recipient,
      status: "pending",
    });
  }
}
