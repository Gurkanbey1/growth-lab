import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

async function getChatIds() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('telegram_chat_id')
    .not('telegram_chat_id', 'is', null);
  
  if (error) {
    console.error("Error fetching chat IDs:", error);
    return [];
  }
  
  return data.map(row => row.telegram_chat_id).filter(Boolean);
}

async function sendTelegramMessage(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    console.error(`Failed to send Telegram message to ${chatId}:`, await response.text());
  } else {
    console.log(`Message sent successfully to ${chatId}`);
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

      case "test":
        message = data.message || `🧪 <b>Test Mesajı</b>\n\nSistem çalışıyor! ✅`;
        break;

      default:
        message = `ℹ️ <b>Bildirim</b>\n\n${JSON.stringify(data, null, 2)}`;
    }

    // Get all chat IDs from database
    const chatIds = await getChatIds();
    
    if (chatIds.length === 0) {
      console.log("No chat IDs found in database");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No Telegram chat IDs configured" 
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send message to all chat IDs
    console.log(`Sending message to ${chatIds.length} chat(s)`);
    await Promise.all(chatIds.map(chatId => sendTelegramMessage(chatId, message)));

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_to: chatIds.length 
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
