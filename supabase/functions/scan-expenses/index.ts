import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Configuration, PlaidApi, PlaidEnvironments } from "npm:plaid"

// 1. Setup Plaid Client
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

// 2. Define Tax Keywords — comprehensive US gig worker coverage
const KEYWORDS: Record<string, string[]> = {
  gig: [
    'uber', 'lyft', 'doordash', 'grubhub', 'instacart', 'postmates',
    'gopuff', 'shipt', 'amazon flex', 'roadie', 'spark driver',
    'favor', 'veho', 'point pickup', 'waitr', 'bite squad',
  ],
  gas: [
    'shell', 'chevron', 'exxon', 'mobil', 'bp', 'arco', 'valero',
    'circle k', '76', 'conoco', 'phillips 66', 'marathon', 'speedway',
    'sunoco', 'citgo', 'gulf', 'loves', 'pilot', 'flying j',
    'sinclair', 'murphy usa', 'racetrac', 'qt', 'quiktrip',
    'maverik', 'caseys', 'kwik trip', 'wawa fuel', 'sheetz fuel',
    'costco gas', 'kroger fuel', 'safeway fuel', 'royal farms',
    'mapco', 'thorntons', 'cefco', 'bucees', 'fuel', 'gasoline',
    'gas station', 'ev charging', 'chargepoint', 'electrify america',
  ],
  car_payments: [
    'ally auto', 'capital one auto', 'chase auto', 'td auto',
    'santander consumer', 'westlake financial', 'carvana', 'carmax',
    'exeter finance', 'credit acceptance', 'drivetime', 'vroom',
    'auto loan', 'car payment', 'vehicle payment', 'car note',
    'gm financial', 'ford motor credit', 'toyota financial',
    'honda financial', 'chrysler capital', 'auto finance',
  ],
  phone: [
    'verizon', 'att', 'at&t', 't-mobile', 'tmobile', 'sprint',
    'boost mobile', 'cricket', 'metro pcs', 'visible', 'mint mobile',
    'google fi', 'xfinity mobile', 'spectrum mobile', 'us cellular',
    'consumer cellular', 'straight talk', 'tracfone', 'simple mobile',
    'ultra mobile', 'ting', 'republic wireless', 'red pocket',
    'lycamobile', 'h2o wireless', 'net10', 'phone bill',
  ],
  insurance: [
    'geico', 'progressive', 'state farm', 'allstate', 'farmers',
    'usaa', 'liberty mutual', 'nationwide', 'travelers',
    'american family', 'the hartford', 'esurance', 'safeco',
    'mercury', 'root insurance', 'lemonade auto', 'clearcover',
    'next insurance', 'auto insurance', 'car insurance',
    'rideshare insurance', 'the general',
  ],
  repairs: [
    'jiffy lube', 'valvoline', 'pep boys', 'autozone', 'oreilly',
    'napa', 'advance auto', 'firestone', 'goodyear', 'discount tire',
    'mavis', 'midas', 'meineke', 'aamco', 'les schwab', 'safelite',
    'oil change', 'auto repair', 'mechanic', 'car wash', 'tire',
    'take 5', 'grease monkey', 'tires plus', 'brake check',
    'walmart auto', 'walmart tire', 'walmart tire & lube',
    'walmart auto care', 'walmart auto center',
    'lube center', 'lube shop', 'lube express', 'oil and lube',
    'auto service', 'auto center', 'auto shop', 'auto care',
    'tire shop', 'brake shop', 'muffler shop', 'body shop',
  ],
  tolls: [
    'ezpass', 'e-zpass', 'fastrak', 'sunpass', 'ipass', 'txtag',
    'peach pass', 'good2go', 'toll', 'turnpike', 'bridge toll',
    'toll road', 'expressway', 'thruway',
  ],
  parking: [
    'parking', 'garage', 'meter', 'valet', 'spothero', 'parkwhiz',
    'parkmobile', 'paybyphone', 'the parking spot', 'airport parking',
    'sp+ parking', 'laz parking', 'ace parking',
  ],
  tech: [
    'apple', 'adobe', 'aws', 'google', 'cursor', 'best buy',
    'staples', 'office depot',
  ],
  meals: [
    'starbucks', 'mcdonalds', 'dunkin', 'taco bell', 'chick-fil-a',
    'burger king', 'wendys', 'chipotle', 'panera', 'subway', 'sonic',
    'popeyes', 'kfc', 'arbys', 'jack in the box', 'dominos',
    'pizza hut', 'five guys', 'whataburger', 'in-n-out',
    'shake shack', 'wingstop', 'raising canes', 'zaxbys', 'culvers',
    'waffle house', 'ihop', 'dennys', 'applebees', 'chilis',
    'olive garden', 'buffalo wild wings', 'wawa', 'sheetz',
    'jersey mikes', 'jimmy johns', 'firehouse subs', 'potbelly',
    'qdoba', 'tropical smoothie', 'dutch bros', 'tim hortons',
    'caribou coffee', 'peets coffee',
  ],
  subscriptions: [
    'spotify', 'apple music', 'amazon music', 'pandora',
    'youtube premium', 'sirius', 'siriusxm', 'quickbooks',
    'freshbooks', 'wave apps', 'expensify', 'stride', 'everlance',
    'gridwise', 'solo', 'turbotax', 'hurdlr', 'mileiq', 'triplog',
    'para', 'maxymo', 'mystro',
  ],
  fees: [
    'checkr', 'sterling', 'background check', 'fingerprint',
    'dmv', 'vehicle registration', 'business license', 'llc filing',
  ],
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    // 3. Get User ID from Supabase Auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Invalid user token')

    // 4. Get Access Token from Database
    const { data: bankData, error: dbError } = await supabase
      .from('user_bank_accounts')
      .select('access_token')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (dbError || !bankData) throw new Error('No bank account connected')

    // 5. Fetch Transactions (Last 365 Days)
    const now = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(now.getFullYear() - 1)

    const response = await plaidClient.transactionsGet({
      access_token: bankData.access_token,
      start_date: oneYearAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    })

    // 6. Filter for Write-offs
    const writeOffs = response.data.transactions.filter(tx => {
      const name = (tx.merchant_name || tx.name).toLowerCase()
      return Object.values(KEYWORDS).some(category =>
        category.some(keyword => name.includes(keyword))
      )
    }).map(tx => ({
      id: tx.transaction_id,
      date: tx.date,
      name: tx.merchant_name || tx.name,
      amount: tx.amount, // Plaid: positive amount = expense
      category: Object.keys(KEYWORDS).find(cat =>
        KEYWORDS[cat].some(k => (tx.merchant_name || tx.name).toLowerCase().includes(k))
      )
    }))

    return new Response(JSON.stringify({ success: true, count: writeOffs.length, transactions: writeOffs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})