import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get all table names
    const tables = [
      'ai_prompt_history',
      'companies',
      'domains',
      'expense_payments',
      'expenses',
      'notes',
      'profiles',
      'project_payments',
      'projects',
      'revenues',
      'social_media_accounts',
      'user_roles',
      'user_settings'
    ]

    let sqlDump = `-- Database Backup
-- Generated: ${new Date().toISOString()}
-- User: ${user.email}

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

`

    for (const table of tables) {
      const { data, error } = await supabaseClient
        .from(table)
        .select('*')

      if (error) {
        console.error(`Error fetching ${table}:`, error)
        continue
      }

      if (!data || data.length === 0) {
        continue
      }

      sqlDump += `\n-- Table: ${table}\n`
      sqlDump += `-- Rows: ${data.length}\n\n`

      for (const row of data) {
        const columns = Object.keys(row)
        const values = columns.map(col => {
          const val = row[col]
          if (val === null) return 'NULL'
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
          if (typeof val === 'boolean') return val ? 'true' : 'false'
          if (val instanceof Date) return `'${val.toISOString()}'`
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
          return String(val)
        })

        sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`
      }

      sqlDump += '\n'
    }

    return new Response(sqlDump, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="database-backup-${new Date().toISOString().split('T')[0]}.sql"`
      }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
