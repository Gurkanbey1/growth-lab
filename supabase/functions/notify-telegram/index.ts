import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID"); // Kullanıcının chat ID'sini buraya eklemesi gerekiyor
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendTelegramMessage(text: string) {
  if (!TELEGRAM_CHAT_ID) {
    console.log("TELEGRAM_CHAT_ID not set, skipping notification");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    console.error("Failed to send Telegram message:", await response.text());
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    let message = "";

    switch (type) {
      case "expense_added":
        message =
          `🔴 <b>Yeni Gider Eklendi</b>\n\n` +
          `💰 Tutar: ${Number(data.amount).toLocaleString("tr-TR")} TL\n` +
          `📝 Açıklama: ${data.description}\n` +
          `${data.category ? `🏷️ Kategori: ${data.category}\n` : ""}` +
          `⏰ ${new Date().toLocaleString("tr-TR")}`;
        break;

      case "revenue_added":
        message =
          `🟢 <b>Yeni Gelir Eklendi</b>\n\n` +
          `💰 Tutar: ${Number(data.amount).toLocaleString("tr-TR")} TL\n` +
          `📝 Açıklama: ${data.description}\n` +
          `${data.company ? `🏢 Firma: ${data.company}\n` : ""}` +
          `⏰ ${new Date().toLocaleString("tr-TR")}`;
        break;

      case "payment_due":
        message =
          `⚠️ <b>Ödeme Hatırlatması</b>\n\n` +
          `${data.description}\n` +
          `💰 Tutar: ${Number(data.amount).toLocaleString("tr-TR")} TL\n` +
          `📅 Ödeme Tarihi: ${new Date(data.due_date).toLocaleDateString("tr-TR")}`;
        break;

      case "domain_expiring":
        message =
          `🌐 <b>Domain Sona Eriyor</b>\n\n` +
          `Domain: ${data.domain_name}\n` +
          `📅 Son Tarih: ${new Date(data.expire_date).toLocaleDateString("tr-TR")}\n` +
          `⚠️ ${data.days_left} gün kaldı!`;
        break;

      default:
        message = `ℹ️ <b>Bildirim</b>\n\n${JSON.stringify(data, null, 2)}`;
    }

    await sendTelegramMessage(message);

    return new Response(JSON.stringify({ success: true }), {
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
