import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
  try {
    console.log("Checking domain expiry...");
    
    // Get domains expiring in the next 7 days
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);

    const { data: domains, error } = await supabase
      .from("domains")
      .select("*")
      .gte("expire_date", today.toISOString().split("T")[0])
      .lte("expire_date", sevenDaysLater.toISOString().split("T")[0]);

    if (error) {
      console.error("Error fetching domains:", error);
      throw error;
    }

    console.log(`Found ${domains?.length || 0} domains expiring soon`);

    // Send notification for each expiring domain
    for (const domain of domains || []) {
      const expireDate = new Date(domain.expire_date);
      const daysLeft = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      try {
        await supabase.functions.invoke("notify-telegram", {
          body: {
            type: "domain_expiring",
            data: {
              domain_name: domain.domain_name,
              expire_date: domain.expire_date,
              days_left: daysLeft,
            },
          },
        });
        console.log(`Notification sent for domain: ${domain.domain_name}`);
      } catch (notifyError) {
        console.error(`Error sending notification for ${domain.domain_name}:`, notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${domains?.length || 0} domains`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-domain-expiry:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
