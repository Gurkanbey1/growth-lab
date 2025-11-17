import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = `Sen bir iş yönetim asistanısın. Kullanıcının doğal dildeki talebini analiz edip yapılandırılmış veri çıkar.

Örnekler:
- "yeni firma autogold 1500 aylık anlaşma sosyal medya yönetimi her ayın 5 de ödeme için hatırlat"
  -> Firma: autogold, Proje: sosyal medya yönetimi, Bütçe: 1500, Ödeme günü: 5
  
- "müşteri tesla 5000 tl web sitesi geliştirme 15 inde ödeme"
  -> Firma: tesla (müşteri), Proje: web sitesi geliştirme, Bütçe: 5000, Ödeme günü: 15

Firma tipi belirtilmemişse "customer" kullan. Proje durumu belirtilmemişse "active" kullan.`;

    const body = {
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "create_business_entities",
            description: "Firma, proje ve hatırlatıcı oluştur",
            parameters: {
              type: "object",
              properties: {
                company: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { 
                      type: "string", 
                      enum: ["customer", "freelancer", "supplier"],
                      description: "Firma tipi"
                    },
                    email: { type: "string" },
                    phone: { type: "string" }
                  },
                  required: ["name", "type"]
                },
                project: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    budget: { type: "number" },
                    description: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["active", "completed", "cancelled", "pending"]
                    }
                  },
                  required: ["name", "budget"]
                },
                expense: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    amount: { type: "number" },
                    frequency: {
                      type: "string",
                      enum: ["once", "monthly", "quarterly", "biannual", "yearly"]
                    },
                    payment_day: { type: "number" }
                  }
                }
              },
              required: ["company", "project"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "create_business_entities" } }
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0].message.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const entities = JSON.parse(toolCall.function.arguments);
    console.log("Parsed entities:", entities);

    // Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: entities.company.name,
        type: entities.company.type,
        email: entities.company.email || null,
        phone: entities.company.phone || null,
        created_by: user.id
      })
      .select()
      .single();

    if (companyError) {
      console.error("Error creating company:", companyError);
      throw companyError;
    }

    // Create project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        company_id: company.id,
        name: entities.project.name,
        budget: entities.project.budget,
        description: entities.project.description || null,
        status: entities.project.status || "active",
        created_by: user.id
      })
      .select()
      .single();

    if (projectError) {
      console.error("Error creating project:", projectError);
      throw projectError;
    }

    // Create expense if specified
    let expense = null;
    if (entities.expense) {
      const nextPaymentDate = entities.expense.payment_day 
        ? new Date(new Date().getFullYear(), new Date().getMonth(), entities.expense.payment_day).toISOString().split('T')[0]
        : null;

      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          company_id: company.id,
          description: entities.expense.description || `${entities.project.name} - Ödeme`,
          amount: entities.expense.amount,
          frequency: entities.expense.frequency || "monthly",
          payment_day: entities.expense.payment_day || null,
          next_payment_date: nextPaymentDate,
          created_by: user.id
        })
        .select()
        .single();

      if (expenseError) {
        console.error("Error creating expense:", expenseError);
        throw expenseError;
      }
      expense = expenseData;
    }

    return new Response(
      JSON.stringify({
        success: true,
        company,
        project,
        expense
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in ai-quick-create function:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
