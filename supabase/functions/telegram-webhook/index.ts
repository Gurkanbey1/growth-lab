import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

async function handleExpenseAdd(chatId: number, params: string[]) {
  // Format: /gider <tutar> <açıklama> <kategori(opsiyonel)>
  if (params.length < 2) {
    await sendTelegramMessage(
      chatId,
      "❌ Kullanım: /gider <tutar> <açıklama> <kategori(opsiyonel)>\n\nÖrnek: /gider 500 Elektrik faturası Faturalar"
    );
    return;
  }

  const amount = parseFloat(params[0]);
  if (isNaN(amount)) {
    await sendTelegramMessage(chatId, "❌ Geçersiz tutar!");
    return;
  }

  const description = params.slice(1, params.length - (params.length > 2 ? 1 : 0)).join(" ");
  const category = params.length > 2 ? params[params.length - 1] : null;

  const { error } = await supabase.from("expenses").insert({
    amount,
    description,
    category,
    frequency: "once",
    is_active: true,
  });

  if (error) {
    console.error("Error adding expense:", error);
    await sendTelegramMessage(chatId, `❌ Hata: ${error.message}`);
  } else {
    await sendTelegramMessage(
      chatId,
      `✅ Gider eklendi!\n💰 Tutar: ${amount.toLocaleString("tr-TR")} TL\n📝 Açıklama: ${description}${category ? `\n🏷️ Kategori: ${category}` : ""}`
    );
  }
}

async function handleRevenueAdd(chatId: number, params: string[]) {
  // Format: /gelir <tutar> <açıklama>
  if (params.length < 2) {
    await sendTelegramMessage(
      chatId,
      "❌ Kullanım: /gelir <tutar> <açıklama>\n\nÖrnek: /gelir 5000 Proje ödemesi"
    );
    return;
  }

  const amount = parseFloat(params[0]);
  if (isNaN(amount)) {
    await sendTelegramMessage(chatId, "❌ Geçersiz tutar!");
    return;
  }

  const description = params.slice(1).join(" ");

  const { error } = await supabase.from("revenues").insert({
    amount,
    description,
    revenue_date: new Date().toISOString().split("T")[0],
  });

  if (error) {
    console.error("Error adding revenue:", error);
    await sendTelegramMessage(chatId, `❌ Hata: ${error.message}`);
  } else {
    await sendTelegramMessage(
      chatId,
      `✅ Gelir eklendi!\n💰 Tutar: ${amount.toLocaleString("tr-TR")} TL\n📝 Açıklama: ${description}`
    );
  }
}

async function handleSummary(chatId: number) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const { data: revenues } = await supabase
    .from("revenues")
    .select("amount")
    .gte("revenue_date", startOfMonth.toISOString().split("T")[0])
    .lte("revenue_date", endOfMonth.toISOString().split("T")[0]);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString());

  const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const totalExpense = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const balance = totalRevenue - totalExpense;

  await sendTelegramMessage(
    chatId,
    `📊 <b>Aylık Özet</b>\n\n` +
      `💰 Gelir: ${totalRevenue.toLocaleString("tr-TR")} TL\n` +
      `💸 Gider: ${totalExpense.toLocaleString("tr-TR")} TL\n` +
      `📈 Bakiye: ${balance.toLocaleString("tr-TR")} TL`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log("Telegram update:", update);

    if (!update.message?.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const [command, ...params] = text.split(/\s+/);

    switch (command.toLowerCase()) {
      case "/start":
        await sendTelegramMessage(
          chatId,
          "👋 Hoş geldiniz! Wind Medya CRM Bot'a hoş geldiniz.\n\n" +
            "📋 <b>Komutlar:</b>\n" +
            "/gider <tutar> <açıklama> - Gider ekle\n" +
            "/gelir <tutar> <açıklama> - Gelir ekle\n" +
            "/ozet - Aylık özet görüntüle\n" +
            "/chatid - Chat ID'nizi öğrenin\n" +
            "/yardim - Yardım mesajı"
        );
        break;

      case "/chatid":
        await sendTelegramMessage(
          chatId,
          `📋 <b>Chat ID'niz:</b> <code>${chatId}</code>\n\n` +
            "Bu ID'yi ayarlar sayfasında 'Telegram Chat ID' alanına yapıştırın."
        );
        break;

      case "/gider":
        await handleExpenseAdd(chatId, params);
        break;

      case "/gelir":
        await handleRevenueAdd(chatId, params);
        break;

      case "/ozet":
        await handleSummary(chatId);
        break;

      case "/yardim":
        await sendTelegramMessage(
          chatId,
          "📋 <b>Komut Listesi:</b>\n\n" +
            "/gider <tutar> <açıklama> <kategori> - Gider ekle\n" +
            "Örnek: /gider 500 Elektrik faturası\n\n" +
            "/gelir <tutar> <açıklama> - Gelir ekle\n" +
            "Örnek: /gelir 5000 Proje ödemesi\n\n" +
            "/ozet - Bu ay için gelir/gider özeti\n\n" +
            "/chatid - Chat ID'nizi öğrenin\n\n" +
            "/yardim - Bu yardım mesajı"
        );
        break;

      default:
        await sendTelegramMessage(
          chatId,
          "❓ Bilinmeyen komut. /yardim yazarak komutları görebilirsiniz."
        );
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
