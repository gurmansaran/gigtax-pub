# GigTax App — Full Progress Report
**Version:** 1.0.0  
**Last Updated:** February 2026  
**Status:** Functional tax preparation app with comprehensive wizard; PDF form generation needs completion for full "fileable" product

---

## 📱 App Overview

**GigTax** is a React Native (Expo) mobile app designed for gig workers to track income, expenses, and file their taxes. The app provides a complete tax preparation workflow from data entry through tax calculation to form generation.

**Platform:** iOS & Android (Expo)  
**Backend:** Supabase (PostgreSQL, Storage, Auth)  
**Theme:** Robinhood-inspired dark/light mode

---

## ✅ Core Features Implemented

### 1. **Authentication & Onboarding**
- ✅ Supabase Auth (email/password)
- ✅ Multi-step onboarding flow:
  - Step 1: Personal info (name, address, SSN, DOB)
  - Step 2: Filing status, spouse info
  - Step 4: Gig app selection (Uber, Lyft, DoorDash, Amazon Flex, Instacart)
- ✅ Profile management with secure SSN storage
- ✅ Biometric authentication (expo-local-authentication)

### 2. **Income Tracking** (`app/(tabs)/earnings.tsx`)
- ✅ Manual income entry (W-2, 1099)
- ✅ Document scanning (W-2, 1099) with OCR (Claude OCR service)
- ✅ Multiple W-2 support (multiple employers)
- ✅ Multiple 1099 sources (gig platforms, freelance)
- ✅ Tip income tracking
- ✅ Capital gains entry (short-term, long-term)
- ✅ Spouse income (W-2, 1099) for joint returns
- ✅ Interest, dividends, unemployment, Social Security, rental income
- ✅ Income categorization and source tracking

### 3. **Expense Tracking** (`app/(tabs)/expenses.tsx`)
- ✅ Manual expense entry (date, category, amount, description)
- ✅ Receipt scanning and attachment (expo-image-picker)
- ✅ Receipt storage in Supabase Storage (cloud backup)
- ✅ Expense categories (gas, repairs, insurance, supplies, etc.)
- ✅ Date-based expense tracking
- ✅ PDF receipt support
- ✅ Expense review and editing

### 4. **Mileage Tracking** (`components/tracker/MileageTracker.tsx`)
- ✅ Automatic trip tracking (expo-location, expo-task-manager)
- ✅ Background location tracking
- ✅ Geofencing for trip start/end detection
- ✅ Manual trip entry
- ✅ Mileage rate calculation ($0.70/mile for 2025)
- ✅ Trip history with earnings, miles, start/end locations
- ✅ Trip editing and deletion

### 5. **Smart Deduction Finder** (`app/(tabs)/deductions.tsx`)
- ✅ Interactive checklist of high-value gig deductions:
  - Business Music & Apps (Spotify, QuickBooks, etc.) — max $500
  - Passenger Amenities (water, sanitizer, etc.) — max $300
  - Hardware & Supplies (hot bags, mounts, chargers) — max $1,000
  - Bank & Platform Fees (instant cash-out fees) — max $500
  - Cell Phone Plan (50% business use auto-calculated) — max $1,200
- ✅ Real-time tax savings calculation
- ✅ Progress bar showing potential savings
- ✅ Pro tips (e.g., joint filing savings)

### 6. **Bank Transaction Integration** (`app/(tabs)/bank-transactions.tsx`)
- ✅ Plaid SDK integration (sandbox-ready)
- ✅ Bank account linking
- ✅ Transaction fetching
- ✅ Auto-categorization of business expenses:
  - Gas stations → Gas expense
  - Auto repair shops → Repairs expense
  - Oil change services → Maintenance expense
  - Insurance payments → Insurance expense
- ✅ One-tap expense creation from transactions
- ✅ Mock data for sandbox testing

### 7. **Insights & Analytics** (`app/(tabs)/insights.tsx`)
- ✅ Monthly breakdown (earnings, miles, trips, expenses)
- ✅ Weekly drill-down (tap month to see weekly breakdown)
- ✅ Year-over-year comparison (current vs previous year)
- ✅ Average monthly earnings tracking
- ✅ Historical data stored in Supabase (`yearly_summaries` table)
- ✅ Visual cards with key metrics

### 8. **Tax Analysis** (`app/(tabs)/analysis.tsx`)
- ✅ Real-time tax calculation (federal + state)
- ✅ Tax liability estimation
- ✅ Quarterly payment recommendations
- ✅ Effective tax rate calculation
- ✅ Refund/amount owed projection
- ✅ Quarterly tax payment reminders (expo-notifications):
  - Scheduled 7 days before and 1 day before deadlines
  - 2025 deadlines: Apr 15, Jun 16, Sep 15, Jan 15
- ✅ Safe Harbor calculation
- ✅ Penalty risk assessment

### 9. **File Now — Comprehensive Tax Filing Wizard** (`app/(tabs)/file-now.tsx`)

**15-Step Wizard Flow:**

1. **Kickoff** — Date of birth entry (MM/DD/YYYY), auto-detects 65+ for senior deduction
2. **Personal Details** — Filing status, name, SSN, spouse info (if MFJ/MFS), state of residence, 65+/blind checkboxes
3. **W-2 Income** — Multiple W-2 entries with employer, wages, federal withholding
4. **1099 Income** — Multiple 1099 sources (gig platforms, freelance), tip portion, withholding
5. **Spouse W-2** (if MFJ/MFS) — Spouse's W-2 income and withholding
6. **Spouse 1099** (if MFJ/MFS) — Spouse's 1099 income
7. **Capital Gains** — Short-term and long-term capital gains/losses
8. **Other Income** — Interest, dividends, unemployment, Social Security, rental, alimony, gambling
9. **Dependents** — Add/edit dependents with:
   - Full name
   - Date of birth (MM/DD/YYYY)
   - Relationship (child, parent, sibling, etc.)
   - SSN
   - Child Tax Credit ($2,000) vs Other Dependent Credit ($500) based on age and relationship
10. **Deductions** — Standard vs Itemized optimizer:
    - Standard deduction (with 65+/blind boost)
    - Itemized: mortgage interest, property taxes, charitable donations
    - Home office deduction (simplified or actual method)
    - Student loan interest
    - Health insurance premiums
    - IRA contributions
11. **Education Credits** — Tuition expenses (Form 1098-T), American Opportunity Tax Credit calculation
12. **IRA Optimizer** — Retirement contribution recommendations
13. **Tax Summary** — Full breakdown preview before final calculation
14. **Review & Edit** — Final review with edit capability
15. **Payment Reconciliation** — Estimated taxes paid, final refund/amount owed, detailed tax breakdown

**Wizard Features:**
- ✅ Progress indicator (15 dots)
- ✅ Back/Next navigation with smart step skipping (spouse steps skipped for single filers)
- ✅ Draft saving (AsyncStorage) — resume later
- ✅ Form validation at each step
- ✅ Real-time tax calculation updates
- ✅ Keyboard "Done" button (iOS inputAccessoryView)
- ✅ Date formatting (MM/DD/YYYY) with validation
- ✅ SSN formatting (XXX-XX-XXXX) with validation
- ✅ Family & Dependents modal (professional bottom sheet style)
- ✅ Scroll support on all pages
- ✅ Professional UI with Robinhood theme

### 10. **Tax Engine** (`lib/fileNowTaxEngine.ts`)

**Comprehensive 2025 Tax Calculations:**

- ✅ **Income Calculation:**
  - W-2 wages (multiple employers)
  - 1099/business income (gig platforms, freelance)
  - Capital gains (short-term, long-term)
  - Interest, dividends, unemployment, Social Security, rental, alimony, gambling
  - Tip income with exemption calculation
  - Spouse income (for joint returns)

- ✅ **Deductions:**
  - Standard deduction (2025: $15,000 single, $30,000 MFJ, $22,500 HoH)
  - Senior/blind boost (+$2,000 Single/HoH, +$1,600 MFJ per person)
  - Itemized deductions (mortgage interest, property taxes, charitable donations)
  - SALT cap ($10,000)
  - Home office deduction (simplified or actual)
  - Student loan interest
  - Health insurance premiums
  - IRA contributions

- ✅ **Credits:**
  - Child Tax Credit ($2,000 per qualifying child under 17)
  - Other Dependent Credit ($500 per other dependent)
  - Earned Income Tax Credit (EITC) calculation
  - American Opportunity Tax Credit (education expenses)

- ✅ **Self-Employment Tax:**
  - Social Security tax (12.4% on first $176,100)
  - Medicare tax (2.9% on all income)
  - Additional Medicare tax (0.9% on income over threshold)
  - SE tax deduction (50% of SE tax)

- ✅ **Federal Tax Brackets (2025):**
  - 10%, 12%, 22%, 24%, 32%, 35%, 37%
  - Progressive tax calculation

- ✅ **State Tax:**
  - California (FTB 2025 progressive brackets)
  - Other states (flat rate estimate for SALT approximation)

- ✅ **Penalty Risk Assessment:**
  - Safe Harbor check (90% of current year or 100% of prior year)
  - Required payment calculation
  - Shortfall detection

### 11. **PDF Generation** (`lib/pdfGenerator.ts`, `lib/formGenerator.ts`)

**Current Status:**
- ✅ Attempts to fill official IRS Form 1040 PDF (AcroForm fields)
- ⚠️ **Issue:** IRS PDFs (standard and accessible) use XFA or have no AcroForm fields; pdf-lib can't fill them
- ✅ **Fallback:** Generates 1040-style PDF from HTML (same line numbers: 1a, 9, 11a, 12e, 15, 16, 25d, 33, 34, 37)
- ✅ PDF includes: name, SSN, address, filing status, key line items (income, AGI, deduction, tax, withholding, refund/owed)
- ✅ Share sheet integration (save to Files or print)
- ✅ Cloud PDF storage (Supabase Storage) for audit trail

**Limitation:** The generated PDF is a "1040-style summary" — not the official IRS fillable form. Users can print and mail it, but it's not identical to the official 1040 layout. See `docs/TAX_SOFTWARE_ROADMAP.md` for solutions.

### 12. **Revenue & Monetization** (`lib/purchaseService.ts`, `app/paywall.tsx`)
- ✅ RevenueCat integration (subscription management)
- ✅ Paywall screen with tax savings simulation
- ✅ Pro subscription model
- ✅ Customer center integration

### 13. **Data Persistence**
- ✅ Supabase PostgreSQL database:
  - User profiles (secure SSN storage)
  - Trips (mileage tracking)
  - Expenses (with receipt links)
  - Receipts (cloud storage URLs)
  - Tax forms (PDF storage)
  - Yearly summaries (insights)
  - Plaid items (bank linking)
- ✅ AsyncStorage for:
  - Draft tax returns (resume wizard)
  - Filing status
  - Onboarding completion
- ✅ Secure data handling (encrypted SSN storage)

### 14. **UI/UX Features**
- ✅ Dark/Light theme (Robinhood-inspired)
- ✅ Smooth navigation (expo-router)
- ✅ Haptic feedback (expo-haptics)
- ✅ Loading states and error handling
- ✅ Form validation with inline errors
- ✅ Keyboard management (Done button, auto-dismiss)
- ✅ Scroll support on all pages
- ✅ Professional modals (bottom sheet style)
- ✅ Progress indicators
- ✅ Responsive layouts

---

## 🎯 What's Working

### ✅ Fully Functional
1. **Complete tax preparation workflow** — Users can enter all income, expenses, deductions, and get a calculated tax result
2. **Comprehensive tax engine** — Handles 2025 tax brackets, credits, deductions, SE tax, state tax
3. **15-step wizard** — Guides users through complete tax return preparation
4. **Data tracking** — Income, expenses, mileage, receipts all tracked and stored
5. **Tax calculations** — Accurate federal and state tax calculations
6. **PDF generation** — Produces a 1040-style PDF users can print and mail
7. **Draft saving** — Users can save progress and resume later
8. **Multi-year support** — Historical data tracking for insights

### ⚠️ Partially Working / Needs Improvement
1. **PDF Form Filling** — Can't fill official IRS PDF (XFA/AcroForm issue); falls back to HTML-generated 1040-style PDF
2. **E-File** — Not implemented (requires IRS e-file program participation or partner integration)
3. **Plaid Integration** — Sandbox-ready but needs production Plaid credentials and backend setup
4. **Receipt OCR** — Claude OCR service integrated but may need tuning for accuracy
5. **Schedule Forms** — Only generates main 1040; doesn't generate Schedule 1, Schedule C, Schedule SE, etc. (though calculations include these)

---

## 🚧 Current Limitations

### Critical (Blocks "Sellable" Product)
1. **No Official Form 1040** — Can't fill the actual IRS fillable PDF. Current output is a "1040-style summary" — functional but not identical to the official form.
   - **Impact:** Users can print and mail, but it's not the official IRS form
   - **Solution Path:** See `docs/TAX_SOFTWARE_ROADMAP.md` — Options include building our own 1040 replica or adding e-file

2. **No E-File** — Can't electronically file returns with the IRS
   - **Impact:** Users must print and mail (slower, less convenient)
   - **Solution Path:** Partner with e-file provider or apply for IRS EFIN and build transmitter

3. **Missing Schedules** — Only generates main 1040; doesn't generate supporting schedules (Schedule 1, Schedule C, Schedule SE, Schedule 2, Schedule 3, etc.)
   - **Impact:** Complex returns may need additional forms
   - **Solution Path:** Add schedule generation (HTML/PDF) for common cases (Schedule C for gig income, Schedule 1 for adjustments)

### Non-Critical (Nice to Have)
1. **State Tax** — Only California has full progressive calculation; other states use flat estimate
2. **Advanced Credits** — Some credits (e.g., Child and Dependent Care Credit, Saver's Credit) not implemented
3. **Amended Returns** — No support for Form 1040-X
4. **Prior Year Returns** — Only supports 2025 (current year)
5. **Multi-State Filing** — No support for multiple state returns

---

## 🛠️ Technical Stack

### Frontend
- **Framework:** React Native (Expo SDK 54)
- **Navigation:** Expo Router (file-based routing)
- **State Management:** React Context (CtxProvider)
- **UI:** React Native components + Expo Vector Icons
- **Theme:** Custom Robinhood-inspired dark/light theme
- **Forms:** React Native TextInput, custom components

### Backend
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (receipts, PDFs)
- **Auth:** Supabase Auth
- **Functions:** Supabase Edge Functions (OCR, Plaid)

### Key Libraries
- `pdf-lib` — PDF manipulation (form filling attempt)
- `expo-print` — HTML to PDF generation
- `expo-sharing` — Share PDFs
- `expo-location` — GPS tracking
- `expo-task-manager` — Background tasks
- `expo-notifications` — Quarterly reminders
- `expo-image-picker` — Receipt scanning
- `react-native-plaid-link-sdk` — Bank linking
- `@anthropic-ai/sdk` — OCR service
- `react-native-purchases` — RevenueCat subscriptions

### Development Tools
- TypeScript
- ESLint
- Expo Dev Tools

---

## 📊 Data Models

### Tax Return State (`lib/fileNowTaxEngine.ts`)
- Filing status, W-2s, 1099s, capital gains, dependents, deductions, credits, etc.
- Comprehensive state for 15-step wizard

### Tax Profile (`lib/CtxProvider.tsx`)
- User profile (name, address, SSN, spouse info)
- Filing preferences
- Gig app selections
- Historical data

### Final Tax Result (`lib/fileNowTaxEngine.ts`)
- Gross income, AGI, taxable income
- Federal tax, state tax, SE tax
- Credits (CTC, EITC, education)
- Refund/amount owed
- Penalty risk assessment

---

## 🔐 Security & Compliance

- ✅ Secure SSN storage (encrypted in database)
- ✅ User data isolation (Supabase RLS policies)
- ✅ Biometric authentication
- ✅ Secure cloud storage (Supabase Storage)
- ⚠️ **Missing:** E&O insurance, PTIN registration (if preparing returns for others), state tax preparer registration (if applicable)

---

## 📈 User Flow

1. **Sign Up / Login** → Supabase Auth
2. **Onboarding** → Personal info, filing status, gig apps
3. **Track Income** → Manual entry or scan documents
4. **Track Expenses** → Manual entry or scan receipts
5. **Track Mileage** → Automatic GPS or manual entry
6. **File Now Wizard** → 15-step guided tax preparation
7. **Review & Calculate** → Tax summary and breakdown
8. **Generate PDF** → 1040-style PDF for print & mail
9. **Save Progress** → Draft saved for later completion

---

## 🎯 Next Steps (Priority Order)

### Phase 1: Make It "Fileable" (Critical)
1. **Build 1040 Replica** — Create our own Form 1040 template (HTML/PDF) that matches official IRS layout line-for-line. Populate from tax engine. Output: fileable PDF users can print and mail.
2. **Add Key Schedules** — Generate Schedule 1 (adjustments), Schedule C (business income), Schedule SE (self-employment tax) as needed.

### Phase 2: E-File (High Priority)
1. **Partner with E-File Provider** — Integrate with TaxSlayer, Drake, or similar for e-file capability
2. **OR Apply for EFIN** — Start IRS e-file program application (6–12 months)

### Phase 3: Polish (Medium Priority)
1. **State Tax Expansion** — Add progressive calculations for more states
2. **Advanced Credits** — Implement additional credits (Child Care, Saver's, etc.)
3. **Schedule Generation** — Add all common schedules (Schedule 2, Schedule 3, Schedule 8812, etc.)

### Phase 4: Scale (Low Priority)
1. **Multi-Year Support** — Support prior year returns
2. **Amended Returns** — Form 1040-X support
3. **Multi-State Filing** — Multiple state returns

---

## 📝 Notes

- **Current Version:** 1.0.0
- **Tax Year:** 2025 (2024 tax year filing)
- **Platform:** iOS & Android (Expo)
- **Backend:** Supabase
- **Status:** Functional tax preparation app; needs official form generation or e-file for full "sellable" product

---

## 📚 Documentation

- `FEATURES_IMPLEMENTED.md` — Feature list and setup instructions
- `docs/TAX_SOFTWARE_ROADMAP.md` — Solutions for making the product "fileable"
- `assets/pdfs/README.md` — PDF form generation notes
- `supabase/migrations/` — Database schema migrations

---

**Last Updated:** February 2026  
**Maintained By:** Development Team
