import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Configuration, PlaidApi, PlaidEnvironments } from "npm:plaid"

// Setup Plaid Client
const configuration = new Configuration({
  basePath: PlaidEnvironments[Deno.env.get('PLAID_ENV') ?? 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': Deno.env.get('PLAID_CLIENT_ID'),
      'PLAID-SECRET': Deno.env.get('PLAID_SECRET'),
    },
  },
})
const plaidClient = new PlaidApi(configuration)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    // Get User ID from Supabase Auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Invalid user token')

    // Get Access Token from Database
    const { data: bankData, error: dbError } = await supabase
      .from('user_bank_accounts')
      .select('access_token')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (dbError || !bankData) throw new Error('No bank account connected')

    // Fetch Transactions (Last 365 Days)
    const now = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(now.getFullYear() - 1)

    const response = await plaidClient.transactionsGet({
      access_token: bankData.access_token,
      start_date: oneYearAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    })

    // Filter for deposits (negative amounts in Plaid = deposits/income)
    const deposits = response.data.transactions
      .filter(tx => tx.amount < 0) // Negative = deposit
      .map(tx => ({
        amount: Math.abs(tx.amount), // Flip sign to positive
        date: tx.date,
        description: tx.merchant_name || tx.name || 'Deposit',
        transaction_id: tx.transaction_id,
      }))

    // De-duplication: Check existing records
    const newDeposits = []
    let skippedCount = 0

    for (const deposit of deposits) {
      // Check if record exists with same amount within 3 days
      const depositDate = new Date(deposit.date)
      const threeDaysBefore = new Date(depositDate)
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3)
      const threeDaysAfter = new Date(depositDate)
      threeDaysAfter.setDate(threeDaysAfter.getDate() + 3)

      const { data: existing } = await supabase
        .from('user_income')
        .select('id')
        .eq('user_id', user.id)
        .eq('amount', deposit.amount.toString())
        .gte('date', threeDaysBefore.toISOString().split('T')[0])
        .lte('date', threeDaysAfter.toISOString().split('T')[0])
        .limit(1)

      if (!existing || existing.length === 0) {
        newDeposits.push({
          user_id: user.id,
          amount: deposit.amount,
          date: deposit.date,
          source: 'plaid',
          description: deposit.description,
          status: 'verified',
        })
      } else {
        skippedCount++
      }
    }

    // Insert new deposits
    if (newDeposits.length > 0) {
      const { error: insertError } = await supabase
        .from('user_income')
        .insert(newDeposits)

      if (insertError) {
        throw new Error(`Failed to insert income: ${insertError.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        added: newDeposits.length,
        skipped: skippedCount,
        total: deposits.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
