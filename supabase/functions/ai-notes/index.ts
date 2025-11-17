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
    const { prompt, userId } = await req.json();

    if (!prompt || !userId) {
      throw new Error("Prompt and userId are required");
    }

    // Get user's OpenAI API key from settings
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("openai_api_key")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings?.openai_api_key) {
      throw new Error("OpenAI API key not configured. Please add it in Settings.");
    }

    const openAIApiKey = settings.openai_api_key;

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that helps users organize their notes and reminders. " +
              "When a user provides a note or reminder, extract the following information: " +
              "1. Title (short, descriptive) " +
              "2. Content (full details) " +
              "3. Note type (note, reminder, or task) " +
              "4. Due date (if mentioned, in ISO format) " +
              "Return the result as JSON with keys: title, content, note_type, due_date",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log("AI Response:", aiResponse);

    // Try to parse JSON response
    let noteData;
    try {
      noteData = JSON.parse(aiResponse);
    } catch (e) {
      // If not JSON, create a simple note
      noteData = {
        title: "AI Generated Note",
        content: aiResponse,
        note_type: "note",
        due_date: null,
      };
    }

    // Save to database
    const { data: savedNote, error: saveError } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        title: noteData.title || "Untitled Note",
        content: noteData.content || aiResponse,
        note_type: noteData.note_type || "note",
        due_date: noteData.due_date || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving note:", saveError);
      throw saveError;
    }

    return new Response(
      JSON.stringify({ note: savedNote, aiResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in ai-notes function:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
