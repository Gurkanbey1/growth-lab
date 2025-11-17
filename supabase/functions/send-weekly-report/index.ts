import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const resend = new Resend(RESEND_API_KEY);
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateWeeklyReport() {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  // Get revenues
  const { data: revenues } = await supabase
    .from("revenues")
    .select("amount, description, revenue_date, companies!revenues_company_id_fkey(name), projects(name)")
    .gte("revenue_date", lastWeek.toISOString().split("T")[0])
    .lte("revenue_date", today.toISOString().split("T")[0])
    .order("revenue_date", { ascending: false });

  // Get expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, description, created_at, companies!expenses_company_id_fkey(name), category")
    .gte("created_at", lastWeek.toISOString())
    .lte("created_at", today.toISOString())
    .order("created_at", { ascending: false });

  // Get upcoming renewals
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 7);

  const { data: domains } = await supabase
    .from("domains")
    .select("domain_name, expire_date")
    .gte("expire_date", today.toISOString().split("T")[0])
    .lte("expire_date", futureDate.toISOString().split("T")[0])
    .order("expire_date");

  const { data: socialMedia } = await supabase
    .from("social_media_accounts")
    .select("platform, account_name, renewal_date, companies!social_media_accounts_company_id_fkey(name)")
    .gte("renewal_date", today.toISOString().split("T")[0])
    .lte("renewal_date", futureDate.toISOString().split("T")[0])
    .order("renewal_date");

  const { data: upcomingExpenses } = await supabase
    .from("expenses")
    .select("description, next_payment_date, amount")
    .eq("is_active", true)
    .not("next_payment_date", "is", null)
    .gte("next_payment_date", today.toISOString().split("T")[0])
    .lte("next_payment_date", futureDate.toISOString().split("T")[0])
    .order("next_payment_date");

  const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const totalExpense = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  // Build HTML email
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
          h1 { color: #2563eb; }
          h2 { color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .summary-item { display: flex; justify-content: space-between; margin: 10px 0; }
          .amount { font-weight: bold; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; font-weight: 600; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>📊 Haftalık Rapor - Wind Medya CRM</h1>
        <p>${lastWeek.toLocaleDateString("tr-TR")} - ${today.toLocaleDateString("tr-TR")}</p>

        <div class="summary">
          <h2>💰 Finansal Özet</h2>
          <div class="summary-item">
            <span>Toplam Gelir:</span>
            <span class="amount positive">${totalRevenue.toLocaleString("tr-TR")} TL</span>
          </div>
          <div class="summary-item">
            <span>Toplam Gider:</span>
            <span class="amount negative">${totalExpense.toLocaleString("tr-TR")} TL</span>
          </div>
          <div class="summary-item">
            <span><strong>Net Durum:</strong></span>
            <span class="amount ${totalRevenue - totalExpense >= 0 ? "positive" : "negative"}">
              ${(totalRevenue - totalExpense).toLocaleString("tr-TR")} TL
            </span>
          </div>
        </div>
  `;

  if (revenues && revenues.length > 0) {
    html += `
      <h2>📈 Gelirler (${revenues.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Açıklama</th>
            <th>Firma</th>
            <th>Tutar</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const revenue of revenues) {
      const companyName = Array.isArray(revenue.companies) && revenue.companies.length > 0
        ? revenue.companies[0].name
        : "-";
      html += `
        <tr>
          <td>${new Date(revenue.revenue_date).toLocaleDateString("tr-TR")}</td>
          <td>${revenue.description}</td>
          <td>${companyName}</td>
          <td class="positive">${Number(revenue.amount).toLocaleString("tr-TR")} TL</td>
        </tr>
      `;
    }

    html += `</tbody></table>`;
  }

  if (expenses && expenses.length > 0) {
    html += `
      <h2>📉 Giderler (${expenses.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Açıklama</th>
            <th>Kategori</th>
            <th>Tutar</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const expense of expenses) {
      html += `
        <tr>
          <td>${new Date(expense.created_at).toLocaleDateString("tr-TR")}</td>
          <td>${expense.description}</td>
          <td>${expense.category || "-"}</td>
          <td class="negative">${Number(expense.amount).toLocaleString("tr-TR")} TL</td>
        </tr>
      `;
    }

    html += `</tbody></table>`;
  }

  // Upcoming renewals
  const hasUpcoming =
    (domains && domains.length > 0) ||
    (socialMedia && socialMedia.length > 0) ||
    (upcomingExpenses && upcomingExpenses.length > 0);

  if (hasUpcoming) {
    html += `
      <h2>⏰ Yaklaşan Ödemeler & Yenilemeler (7 Gün İçinde)</h2>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Tür</th>
            <th>Açıklama</th>
            <th>Tutar</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (domains) {
      for (const domain of domains) {
        html += `
          <tr>
            <td>${new Date(domain.expire_date).toLocaleDateString("tr-TR")}</td>
            <td>🌐 Domain</td>
            <td>${domain.domain_name}</td>
            <td>-</td>
          </tr>
        `;
      }
    }

    if (socialMedia) {
      for (const sm of socialMedia) {
        html += `
          <tr>
            <td>${new Date(sm.renewal_date).toLocaleDateString("tr-TR")}</td>
            <td>📱 Sosyal Medya</td>
            <td>${sm.platform} - ${sm.account_name}</td>
            <td>-</td>
          </tr>
        `;
      }
    }

    if (upcomingExpenses) {
      for (const exp of upcomingExpenses) {
        html += `
          <tr>
            <td>${new Date(exp.next_payment_date!).toLocaleDateString("tr-TR")}</td>
            <td>💸 Gider</td>
            <td>${exp.description}</td>
            <td class="negative">${Number(exp.amount).toLocaleString("tr-TR")} TL</td>
          </tr>
        `;
      }
    }

    html += `</tbody></table>`;
  }

  html += `
        <div class="footer">
          <p>Bu rapor otomatik olarak oluşturulmuştur.</p>
          <p>Wind Medya CRM - ${new Date().toLocaleDateString("tr-TR")}</p>
        </div>
      </body>
    </html>
  `;

  return html;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Generating weekly report...");

    const emailHtml = await generateWeeklyReport();

    // Get admin users' emails
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email")
      .not("email", "is", null);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No email addresses found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emails = profiles.map((p) => p.email!);

    const { data, error } = await resend.emails.send({
      from: "Wind Medya CRM <onboarding@resend.dev>",
      to: emails,
      subject: `📊 Haftalık Rapor - ${new Date().toLocaleDateString("tr-TR")}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Weekly report sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
