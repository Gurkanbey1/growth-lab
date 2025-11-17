import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DomainExpiration {
  domain_id: string;
  domain_name: string;
  expire_date: string;
  days_until_expiry: number;
  company_id: string;
  company_name: string;
}

interface ProjectDebt {
  project_id: string;
  project_name: string;
  remaining_amount: number;
  company_id: string;
  company_name: string;
  company_email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get user settings for notification email
    const { data: settings } = await supabase
      .from("user_settings")
      .select("notification_email")
      .limit(1)
      .single();

    const notificationEmail = settings?.notification_email || "admin@example.com";

    // Get upcoming domain expirations (within 30 days)
    const { data: domains, error: domainError } = await supabase
      .rpc("get_upcoming_domain_expirations", { days_ahead: 30 });

    if (domainError) {
      console.error("Error fetching domains:", domainError);
    }

    // Get projects with remaining debt
    const { data: debts, error: debtError } = await supabase
      .rpc("get_projects_with_debt");

    if (debtError) {
      console.error("Error fetching debts:", debtError);
    }

    const emailsSent = [];

    // Send domain expiration reminders
    if (domains && domains.length > 0) {
      const domainList = domains
        .map((d: DomainExpiration) => 
          `- ${d.domain_name} (${d.company_name}) - ${d.days_until_expiry} gün içinde süresi dolacak`
        )
        .join("\n");

      const domainEmailResult = await resend.emails.send({
        from: "Lovable <onboarding@resend.dev>",
        to: [notificationEmail],
        subject: `⚠️ ${domains.length} Domain Yenileme Hatırlatması`,
        html: `
          <h2>Yaklaşan Domain Yenilemeleri</h2>
          <p>Aşağıdaki domainlerin süreleri yakında dolacak:</p>
          <pre>${domainList}</pre>
          <p><strong>Toplam: ${domains.length} domain</strong></p>
          <p>Lütfen yenileme işlemlerini zamanında yapınız.</p>
        `,
      });

      emailsSent.push({ type: "domain", count: domains.length, result: domainEmailResult });
      console.log("Domain reminder email sent:", domainEmailResult);
    }

    // Send debt reminders
    if (debts && debts.length > 0) {
      const debtList = debts
        .map((d: ProjectDebt) => 
          `- ${d.project_name} (${d.company_name}) - Kalan: ${Number(d.remaining_amount).toLocaleString("tr-TR")} ₺`
        )
        .join("\n");

      const totalDebt = debts.reduce((sum: number, d: ProjectDebt) => sum + Number(d.remaining_amount), 0);

      const debtEmailResult = await resend.emails.send({
        from: "Lovable <onboarding@resend.dev>",
        to: [notificationEmail],
        subject: `💰 ${debts.length} Proje Borç Hatırlatması`,
        html: `
          <h2>Bekleyen Proje Ödemeleri</h2>
          <p>Aşağıdaki projelerde ödenmemiş tutarlar bulunmaktadır:</p>
          <pre>${debtList}</pre>
          <p><strong>Toplam Borç: ${totalDebt.toLocaleString("tr-TR")} ₺</strong></p>
          <p>Lütfen ödeme takibini yapınız.</p>
        `,
      });

      emailsSent.push({ type: "debt", count: debts.length, result: debtEmailResult });
      console.log("Debt reminder email sent:", debtEmailResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${emailsSent.length} hatırlatma e-postası gönderildi`,
        details: emailsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-reminder-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
