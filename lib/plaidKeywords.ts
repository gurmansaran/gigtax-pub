/**
 * Comprehensive Plaid Transaction Keywords
 * Used for auto-categorizing income and expense transactions
 * from gig workers' bank accounts across the United States.
 *
 * Covers rideshare, delivery, freelance, creative, resale, rental,
 * medical transport, warehouse, and dozens of expense categories
 * including regional chains and carriers.
 */

export const INCOME_KEYWORDS: Record<string, string[]> = {
  // ─── Rideshare ────────────────────────────────────────────
  rideshare: [
    'uber', 'lyft', 'via', 'juno', 'gett', 'curb', 'wingz',
    'hop skip drive', 'zum', 'kango', 'alto', 'ryde',
    'empower', 'spark driver', 'walmart spark', 'veyo',
    'medivan', 'goshare', 'bellhop', 'lugg',
  ],

  // ─── Food Delivery ───────────────────────────────────────
  food_delivery: [
    'doordash', 'uber eats', 'grubhub', 'postmates', 'seamless',
    'caviar', 'deliveroo', 'just eat', 'delivery.com', 'eat24',
    'foodpanda', 'swiggy', 'zomato',
    'waitr', 'bite squad', 'slice', 'toast takeout', 'chowbus',
    'fantuan', 'hungry panda', 'chowman', 'menulog',
  ],

  // ─── Grocery Delivery ────────────────────────────────────
  grocery_delivery: [
    'instacart', 'shipt', 'dumpling', 'cornershop', 'getir',
    'gopuff', 'gorillas', 'flink', 'jokr',
    'spark delivery', 'walmart delivery', 'point pickup grocery',
    'fresh direct', 'freshdirect', 'imperfect foods',
    'misfits market', 'thrive market', 'hungryroot',
    'weee', 'sayweee',
  ],

  // ─── Package Delivery ────────────────────────────────────
  package_delivery: [
    'amazon flex', 'roadie', 'favor delivery', 'point pickup',
    'skipcart', 'dispatch', 'onfleet', 'lalamove',
    'deliv', 'frayt', 'dolly', 'taskrabbit delivery',
    'veho', 'amazon dsp', 'ontrac', 'lasership', 'axlehire',
    'cdl driver', 'ups personal vehicle', 'fedex ground',
    'fedex contractor', 'ups driver', 'dhl contractor',
    'courier express', 'jitsu', 'dropoff',
  ],

  // ─── Payment Processors (gig income) ─────────────────────
  payment_processors: [
    'stripe transfer', 'stripe payout', 'paypal income',
    'venmo payment', 'cashapp payment', 'zelle deposit',
    'square deposit', 'braintree', 'adyen payout',
    'wise transfer', 'payoneer',
    'direct deposit', 'ach credit', 'ach deposit',
    'gusto payroll', 'deel', 'remote.com',
    'check deposit', 'mobile deposit',
  ],

  // ─── Freelance & Service Platforms ────────────────────────
  freelance: [
    'upwork', 'fiverr', 'freelancer', 'guru', 'toptal',
    'thumbtack', 'taskrabbit', 'handy', 'care.com',
    'rover', 'wag', 'sittercity', 'urbansitter',
    'angi', 'homeadvisor', 'bark', 'porch', 'takl',
    'lawn love', 'lawnstarter', 'plowz', 'housecall pro',
    'nextdoor', 'steady', 'wonolo',
    'helpling', 'merry maids', 'molly maid',
  ],

  // ─── Creative & Resale Platforms ──────────────────────────
  creative_resale: [
    'etsy deposit', 'etsy payout', 'poshmark', 'mercari',
    'depop', 'offerup', 'facebook marketplace', 'fb marketplace',
    'swappa', 'stockx', 'whatnot', 'grailed',
    'ebay payout', 'ebay deposit', 'redbubble', 'printful',
    'teespring', 'society6', 'zazzle', 'threadless',
    'shutterstock', 'adobe stock', 'istock',
    'canva creator', 'creative market', 'gumroad',
    'teachable', 'udemy', 'skillshare', 'patreon',
    'ko-fi', 'buymeacoffee', 'substack',
  ],

  // ─── Warehouse & Temp Gigs ────────────────────────────────
  warehouse_temp: [
    'instawork', 'qwick', 'bluecrew', 'shiftgig',
    'gigsmart', 'indeed flex', 'staffmark', 'aerotek',
    'kelly services', 'randstad', 'robert half',
    'adecco', 'manpower', 'express employment',
    'peopleready', 'trueblue',
  ],

  // ─── Other Gig Platforms ──────────────────────────────────
  other_gig: [
    'airbnb payout', 'vrbo payout', 'turo', 'getaround',
    'hyrecar', 'spinlister', 'outdoorsy', 'rvshare',
    'neighbor storage', 'swimply', 'sniffspot', 'peerspace',
    'hipcamp', 'harvest hosts', 'boatsetter', 'click boat',
    'fat llama', 'shareGrid', 'kitsplit',
  ],
};

export const EXPENSE_KEYWORDS: Record<string, string[]> = {
  // ─── Gas Stations (comprehensive US coverage) ─────────────
  gas: [
    // National chains
    'shell', 'chevron', 'exxon', 'mobil', 'bp', 'arco',
    'valero', 'circle k', '76', 'conoco', 'phillips 66',
    '7-eleven fuel', 'marathon', 'speedway', 'sunoco',
    'citgo', 'gulf', 'loves', 'pilot', 'flying j',
    'sinclair', 'tesoro', 'murphy usa', 'murphy express',
    // Convenience/gas combos
    'wawa fuel', 'sheetz fuel', 'racetrac', 'qt', 'quiktrip',
    'maverik', 'caseys', "casey's", 'kum & go', 'holiday',
    'kwik trip', 'kwik star',
    // Membership/grocery fuel
    'costco gas', 'sams club fuel', "sam's club fuel", 'bjs gas',
    'kroger fuel', 'safeway fuel', 'albertsons fuel',
    'fred meyer fuel', 'heb fuel', 'h-e-b fuel',
    // Regional chains
    'royal farms', "stewart's", 'mapco', 'thorntons', 'gate',
    'flash foods', 'cefco', 'delek', 'alon', 'diamond shamrock',
    'hess', 'wex fuel', 'bucees', "buc-ee's", 'parker', 'spinx',
    'kangaroo', 'fas mart', 'turkey hill', 'united dairy farmers',
    'stripes', 'allsups', "allsup's", 'loaf n jug',
    // Generic terms
    'fuel', 'gasoline', 'petrol', 'gas station', 'filling station',
    'diesel', 'ev charging', 'chargepoint', 'electrify america',
    'tesla supercharger', 'evgo', 'blink charging',
  ],

  // ─── Car Payments & Auto Loans ────────────────────────────
  car_payments: [
    'ally auto', 'ally financial', 'capital one auto',
    'chase auto', 'chase auto finance', 'td auto',
    'santander consumer', 'westlake financial', 'carvana',
    'carmax', 'carmax auto', 'exeter finance',
    'credit acceptance', 'drivetime', 'vroom',
    'shift payment', 'auto loan', 'car payment',
    'vehicle payment', 'car note', 'auto finance',
    'americredit', 'gm financial', 'ford motor credit',
    'toyota financial', 'honda financial', 'hyundai capital',
    'kia finance', 'nissan motor acceptance', 'chrysler capital',
    'bmw financial', 'mercedes financial', 'world omni',
    'usaa auto loan', 'navy federal auto',
    'penfed auto', 'lightstream', 'myautoloan',
    'capital one auto pay', 'autopay', 'car lease',
    'vehicle lease', 'auto lease',
  ],

  // ─── Auto Repairs & Maintenance ───────────────────────────
  repairs: [
    'jiffy lube', 'valvoline', 'pep boys', 'autozone',
    'oreilly', "o'reilly", 'napa', 'advance auto',
    'firestone', 'goodyear', 'discount tire', 'americas tire',
    'mavis', 'monro', 'midas', 'meineke', 'aamco',
    'penske', 'brakes plus', 'christian brothers',
    'les schwab', 'big o tires', 'safelite', 'aaa',
    'rockauto', 'quick lube', 'oil service',
    'car wash', 'detail', 'oil change', 'tire',
    'auto repair', 'mechanic', 'smog check', 'inspection',
    // Additional chains
    'walmart auto', 'walmart tire', 'walmart tire & lube',
    'walmart auto care', 'walmart auto center',
    'costco tire', 'pepboys',
    'take 5', 'take 5 oil', 'grease monkey',
    'express oil', 'strickland brothers', 'tires plus',
    'ntb', 'national tire', 'sullivan tire',
    'town fair tire', 'belle tire', 'tire kingdom',
    'tire rack', 'sears auto', 'caliber collision',
    'maaco', 'service king', 'gerber collision',
    'carstar', 'batteries plus', 'interstate batteries',
    'brake check', 'sun auto', 'tuffy', 'precision tune',
    'cottman', 'lee myles', 'atra',
    // Local / generic auto shop terms
    'lube center', 'lube shop', 'oil and lube', 'lube express',
    'auto service', 'auto center', 'auto shop', 'auto care',
    'tire shop', 'brake shop', 'muffler shop', 'muffler',
    'alignment', 'transmission', 'exhaust shop', 'radiator',
    'body shop', 'auto body', 'auto glass',
  ],

  // ─── Auto Insurance ───────────────────────────────────────
  insurance: [
    'geico', 'progressive', 'state farm', 'allstate',
    'farmers', 'usaa', 'liberty mutual', 'nationwide',
    'travelers', 'american family', 'the hartford',
    'esurance', 'metlife auto', 'safeco', 'mercury',
    'root insurance', 'lemonade auto', 'clearcover',
    'auto insurance', 'car insurance', 'vehicle insurance',
    // Rideshare & commercial auto
    'rideshare insurance', 'commercial auto', 'next insurance',
    'hiscox', 'simply business', 'thimble', 'toggle insurance',
    'erie insurance', 'auto-owners', 'shelter insurance',
    'wawanesa', 'kemper', 'bristol west', 'dairyland',
    'general insurance', 'the general', 'elephant insurance',
    'metromile', 'mile auto',
  ],

  // ─── Parking ──────────────────────────────────────────────
  parking: [
    'parking', 'park', 'garage', 'meter', 'valet',
    'airport parking', 'spothero', 'parkwhiz', 'parkopedia',
    'parkme', 'bestparking', 'parkmobile', 'paybyphone',
    'honk parking', 'passport parking', 'pango', 'easypark',
    'parkifi', 'townepark', 'laz parking', 'ace parking',
    'sp plus', 'sp+ parking', 'impark', 'standard parking',
    'colonial parking', 'premium parking', 'reef parking',
    'abm parking', 'central parking', 'citizens parking',
    'diamond parking', 'propark', 'ampco',
    // Additional
    'way.com', 'justpark', 'clickandpark',
    'cheapairportparking', 'theparkingspot', 'the parking spot',
    'air park', 'fastpark', 'park n fly', 'wally park',
    'preflight parking', 'peachy airport parking',
  ],

  // ─── Tolls ────────────────────────────────────────────────
  tolls: [
    'ezpass', 'e-zpass', 'fastrak', 'sunpass', 'ipass', 'txtag',
    'peach pass', 'nc quick pass', 'palmetto pass', 'good2go',
    'pikepass', 'k-tag', 'geauxpass', 'leeway', 'riverlink',
    'toll', 'turnpike', 'expressway', 'bridge toll', 'toll road',
    'toll plaza', 'highway toll', 'thruway',
    'ntta', 'north texas tollway', 'illinois tollway',
    'new jersey turnpike', 'pennsylvania turnpike',
    'florida turnpike', 'golden gate bridge', 'bay bridge toll',
    'george washington bridge', 'lincoln tunnel', 'holland tunnel',
    'triborough', 'verrazano', 'bayonne bridge',
    // Additional
    'waze toll', 'tollsmart', 'quickpass', 'bestpass',
    'pretoll', 'ooida', 'drivewyze',
    'ohio turnpike', 'indiana toll road', 'kansas turnpike',
    'oklahoma turnpike', 'maryland ezpass', 'mass pike',
    'dulles toll', 'chesapeake bay bridge',
  ],

  // ─── Phone & Data ─────────────────────────────────────────
  phone: [
    // Major carriers
    'verizon', 'att', 'at&t', 't-mobile', 'tmobile',
    'sprint', 'boost mobile', 'cricket', 'metro pcs',
    'metropcs', 'metro by t-mobile',
    'visible', 'mint mobile', 'google fi', 'xfinity mobile',
    'spectrum mobile', 'us cellular', 'consumer cellular',
    // MVNOs & budget carriers
    'straight talk', 'tracfone', 'total wireless',
    'simple mobile', 'ultra mobile', 'ting', 'republic wireless',
    'red pocket', 'lycamobile', 'h2o wireless', 'net10',
    'page plus', 'wing', 'tello', 'reach mobile',
    'freedompop', 'gen mobile', 'good2go mobile',
    'twigby', 'unreal mobile', 'puretalk',
    // Generic
    'phone bill', 'wireless bill', 'cell phone', 'mobile plan',
    'phone payment', 'wireless payment',
  ],

  // ─── Delivery Supplies & Equipment ────────────────────────
  supplies: [
    'amazon.com', 'walmart', 'target', 'staples',
    'office depot', 'officemax', 'michaels', 'container store',
    'hot bag', 'delivery bag', 'insulated bag', 'cooler',
    'phone mount', 'car charger', 'dash cam', 'phone holder',
    'usb cable', 'aux cord', 'car organizer', 'seat cover',
    'floor mat', 'air freshener', 'cleaning supplies',
    'hand sanitizer', 'mask', 'gloves',
  ],

  // ─── Background Checks & Fees ─────────────────────────────
  fees: [
    'checkr', 'sterling', 'background check', 'fingerprint',
    'dmv', 'vehicle registration', 'smog', 'business license',
    'llc filing', 'incorporation',
    'city permit', 'business permit', 'notary',
    'drug test', 'physical exam', 'dot physical',
  ],

  // ─── Work Apps & Subscriptions ────────────────────────────
  subscriptions: [
    // Music & entertainment (for riders)
    'spotify', 'apple music', 'amazon music', 'pandora',
    'youtube premium', 'sirius', 'siriusxm',
    // Accounting & tax
    'quickbooks', 'freshbooks', 'wave apps', 'expensify',
    'turbotax', 'hurdlr',
    // Mileage & gig trackers
    'stride', 'everlance', 'gridwise', 'solo',
    'mileiq', 'triplog', 'driversnote',
    'para', 'maxymo', 'mystro', 'muver',
    // Credit & identity
    'myfico', 'credit karma premium', 'identity guard',
    // Communication & storage
    'openphone', 'google one', 'icloud storage',
    'icloud', 'dropbox', 'google drive',
  ],

  // ─── Meals (50% deductible for business) ──────────────────
  meals: [
    // National fast food
    'starbucks', 'mcdonalds', "mcdonald's", 'dunkin', "dunkin'",
    'taco bell', 'chick-fil-a', 'burger king', "wendy's", 'wendys',
    'panda express', 'chipotle', 'panera', 'subway', 'sonic',
    'popeyes', 'kfc', "arby's", 'arbys', 'jack in the box',
    "domino's", 'dominos', 'pizza hut', 'papa johns', "papa john's",
    'little caesars', "little caesar's",
    // Regional favorites
    'five guys', 'whataburger', 'in-n-out', 'in n out',
    'shake shack', 'wingstop', "raising cane's", 'raising canes',
    "zaxby's", 'zaxbys', "culver's", 'culvers',
    'checkers', "rally's", 'rallys', "hardee's", 'hardees',
    "carl's jr", 'carls jr', 'del taco', 'el pollo loco',
    "church's chicken", 'churchs chicken', 'white castle',
    // Breakfast & diners
    'waffle house', 'ihop', "denny's", 'dennys',
    'cracker barrel', 'bob evans', 'perkins',
    // Casual dining
    "applebee's", 'applebees', "chili's", 'chilis',
    'olive garden', 'buffalo wild wings', 'bww',
    'red robin', 'red lobster', 'outback',
    'texas roadhouse', 'longhorn', 'golden corral',
    'tgi fridays', "tgi friday's", 'ruby tuesday',
    // Convenience food
    'wawa', 'sheetz', "casey's", 'caseys', 'quickchek',
    "portillo's", 'portillos', 'loves travel stop',
    // Subs & sandwiches
    'firehouse subs', "jersey mike's", 'jersey mikes',
    "jimmy john's", 'jimmy johns', 'penn station',
    'potbelly', "jason's deli", 'jasons deli',
    'which wich', 'quiznos', 'schlotzskys',
    // Mexican
    'qdoba', "moe's", 'moes', 'baja fresh', 'taco cabana',
    'taco bueno', 'taco john', 'torchys', "torchy's",
    // Asian
    'noodles & company', 'noodles and company', 'pei wei',
    'pf changs', "p.f. chang's", 'panda inn',
    'waba grill', 'yoshinoya', 'teriyaki madness',
    // Drinks & smoothies
    'tropical smoothie', 'smoothie king', 'jamba juice', 'jamba',
    'dutch bros', 'tim hortons', 'caribou coffee',
    "peet's coffee", 'peets coffee', 'coffee bean',
    'philz coffee', 'blue bottle', 'scooters coffee',
    // Pizza
    'marcos pizza', "marco's pizza", 'hungry howies',
    'jets pizza', "jet's pizza", 'round table',
    'mountain mikes', 'mod pizza', 'blaze pizza',
    'cicis pizza', "cici's pizza",
    // Chicken
    "bojangles", "bojangles'", 'wingstop', 'slim chickens',
    'golden chick', "bush's chicken", 'mary browns',
    "lee's famous recipe", 'jollibee',
  ],
};

/**
 * Determine if a transaction is income from a gig platform.
 */
export function isGigPlatformIncome(merchantName: string): boolean {
  const lowerName = merchantName.toLowerCase();
  for (const keywords of Object.values(INCOME_KEYWORDS)) {
    if (keywords.some((keyword) => lowerName.includes(keyword))) {
      return true;
    }
  }
  return false;
}

/**
 * Extract the platform name from a merchant string.
 */
export function extractPlatformName(merchantName: string): string {
  const lowerName = merchantName.toLowerCase();
  const platformMap: Record<string, string> = {
    // Rideshare
    uber: 'Uber',
    lyft: 'Lyft',
    via: 'Via',
    empower: 'Empower',
    alto: 'Alto',
    veyo: 'Veyo',
    goshare: 'GoShare',
    // Food Delivery
    doordash: 'DoorDash',
    grubhub: 'Grubhub',
    'uber eats': 'Uber Eats',
    postmates: 'Postmates',
    waitr: 'Waitr',
    'bite squad': 'Bite Squad',
    // Grocery Delivery
    instacart: 'Instacart',
    shipt: 'Shipt',
    gopuff: 'GoPuff',
    'fresh direct': 'FreshDirect',
    // Package Delivery
    'amazon flex': 'Amazon Flex',
    'amazon dsp': 'Amazon DSP',
    roadie: 'Roadie',
    favor: 'Favor',
    veho: 'Veho',
    // Freelance
    upwork: 'Upwork',
    fiverr: 'Fiverr',
    taskrabbit: 'TaskRabbit',
    thumbtack: 'Thumbtack',
    rover: 'Rover',
    wag: 'Wag',
    angi: 'Angi',
    homeadvisor: 'HomeAdvisor',
    handy: 'Handy',
    // Creative & Resale
    etsy: 'Etsy',
    poshmark: 'Poshmark',
    mercari: 'Mercari',
    depop: 'Depop',
    offerup: 'OfferUp',
    stockx: 'StockX',
    whatnot: 'Whatnot',
    ebay: 'eBay',
    redbubble: 'Redbubble',
    // Rentals
    airbnb: 'Airbnb',
    turo: 'Turo',
    getaround: 'Getaround',
    peerspace: 'Peerspace',
    swimply: 'Swimply',
    // Warehouse/Temp
    instawork: 'Instawork',
    wonolo: 'Wonolo',
    qwick: 'Qwick',
    bluecrew: 'BlueCrew',
    gigsmart: 'GigSmart',
    // Payments
    stripe: 'Stripe',
    paypal: 'PayPal',
    venmo: 'Venmo',
    cashapp: 'Cash App',
    square: 'Square',
    zelle: 'Zelle',
  };

  for (const [keyword, name] of Object.entries(platformMap)) {
    if (lowerName.includes(keyword)) return name;
  }
  return merchantName;
}

/**
 * Categorize a Plaid transaction into income or expense category.
 */
export function categorizePlaidTransaction(
  merchantName: string,
  amount: number,
  plaidCategories?: string[]
): { isIncome: boolean; category: string; platform?: string } {
  const lowerName = merchantName.toLowerCase();

  // Check income first
  for (const [, keywords] of Object.entries(INCOME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return {
          isIncome: true,
          category: 'income',
          platform: extractPlatformName(merchantName),
        };
      }
    }
  }

  // Check expense categories
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return {
          isIncome: false,
          category,
        };
      }
    }
  }

  // Fallback: use Plaid's categories if available
  if (plaidCategories?.includes('Transfer') && amount < 0) {
    return { isIncome: true, category: 'income' };
  }

  return { isIncome: false, category: 'other' };
}
