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

async function handleAIMessage(chatId: number, message: string) {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      await sendTelegramMessage(chatId, "❌ AI yapılandırması eksik.");
      return;
    }

    console.log("Calling AI with message:", message);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sen bir finans takip asistanısın. Kullanıcının mesajını analiz et ve gider veya gelir bilgisi içeriyorsa JSON formatında döndür.

Kurallar:
1. Gider mesajlarında: {"type": "expense", "amount": <tutar>, "description": "<açıklama>"}
2. Gelir mesajlarında: {"type": "revenue", "amount": <tutar>, "description": "<açıklama>"}
3. Eğer net bir finansal işlem yoksa veya kullanıcı sohbet ediyorsa: {"type": "chat", "response": "<dostça yanıt>"}
4. Tutarları sadece sayı olarak döndür (para birimi ekleme)
5. Kısa ve öz açıklamalar kullan

Örnekler:
- "150 lira yemek harcadım" → {"type":"expense","amount":150,"description":"Yemek"}
- "3000 TL maaş aldım" → {"type":"revenue","amount":3000,"description":"Maaş"}
- "Merhaba" → {"type":"chat","response":"Merhaba! Size nasıl yardımcı olabilirim?"}
- "Bu ay ne kadar harcadım?" → {"type":"chat","response":"Aylık özet için /ozet komutunu kullanabilirsiniz."}`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status, await response.text());
      await sendTelegramMessage(chatId, "❌ AI ile bağlantı kurulamadı.");
      return;
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log("AI response:", aiResponse);

    // JSON'u parse et
    const parsed = JSON.parse(aiResponse);

    if (parsed.type === "expense") {
      // Gider ekle
      const { error } = await supabase.from("expenses").insert({
        amount: parsed.amount,
        description: parsed.description,
        category: "Genel",
        frequency: "once",
      });

      if (error) {
        console.error("Expense insert error:", error);
        await sendTelegramMessage(chatId, "❌ Gider eklenirken hata oluştu.");
        return;
      }

      await sendTelegramMessage(
        chatId,
        `✅ Gider eklendi!\n\n💸 Tutar: ${parsed.amount.toLocaleString("tr-TR")} TL\n📝 Açıklama: ${parsed.description}`
      );

      // Bildirim gönder
      await supabase.functions.invoke("notify-telegram", {
        body: {
          type: "expense_added",
          data: {
            amount: parsed.amount,
            description: parsed.description,
          },
        },
      });

    } else if (parsed.type === "revenue") {
      // Gelir ekle
      const { error } = await supabase.from("revenues").insert({
        amount: parsed.amount,
        description: parsed.description,
        revenue_date: new Date().toISOString().split("T")[0],
      });

      if (error) {
        console.error("Revenue insert error:", error);
        await sendTelegramMessage(chatId, "❌ Gelir eklenirken hata oluştu.");
        return;
      }

      await sendTelegramMessage(
        chatId,
        `✅ Gelir eklendi!\n\n💰 Tutar: ${parsed.amount.toLocaleString("tr-TR")} TL\n📝 Açıklama: ${parsed.description}`
      );

      // Bildirim gönder
      await supabase.functions.invoke("notify-telegram", {
        body: {
          type: "revenue_added",
          data: {
            amount: parsed.amount,
            description: parsed.description,
          },
        },
      });

    } else if (parsed.type === "chat") {
      await sendTelegramMessage(chatId, parsed.response);
    }

  } catch (error) {
    console.error("AI processing error:", error);
    await sendTelegramMessage(
      chatId,
      "❌ Mesajınız işlenirken bir hata oluştu. Lütfen tekrar deneyin."
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
          "👋 Merhaba! AI destekli finans takip botuna hoş geldiniz.\n\n" +
            "🤖 Artık doğal dille konuşarak gider ve gelir ekleyebilirsiniz!\n\n" +
            "Örnekler:\n" +
            "• '500 lira elektrik faturası ödedim'\n" +
            "• '3000 TL proje ödemesi aldım'\n" +
            "• 'Bugün market alışverişine 250 lira harcadım'\n\n" +
            "Özel komutlar:\n" +
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

      case "/ozet":
        await handleSummary(chatId);
        break;

      case "/yardim":
        await sendTelegramMessage(
          chatId,
          "📖 <b>Yardım</b>\n\n" +
            "🤖 AI ile konuşarak gider ve gelir ekleyebilirsiniz!\n\n" +
            "Örnekler:\n" +
            "• 'Bugün 150 lira yemek harcadım'\n" +
            "• '5000 TL maaş aldım'\n" +
            "• 'Pazara 300 lira verdim'\n" +
            "• '2500 TL freelance işten gelir'\n\n" +
            "Özel komutlar:\n" +
            "/ozet - Aylık finansal özet\n" +
            "/chatid - Chat ID öğren\n" +
            "/yardim - Bu mesaj"
        );
        break;

      default:
        // AI ile işle
        await handleAIMessage(chatId, text);
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
