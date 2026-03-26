# GigTax

A mobile tax preparation app built for gig workers. GigTax handles income and expense tracking, automatic mileage logging, receipt scanning, smart deduction finding, and guided tax filing — all in one place.

## Features

### Income Tracking
- W-2 and 1099 entry for multiple employers and gig platforms
- Document scanning with OCR to auto-extract income data from tax forms
- Support for tips, capital gains, spouse income, interest, dividends, and more

### Expense Tracking & Receipts
- Manual expense entry by category (gas, repairs, insurance, supplies)
- Receipt photo capture with cloud storage
- Receipt OCR for automatic data extraction

### Mileage & Trip Tracking
- Automatic GPS tracking with background mode
- Geofencing for smart trip start/end detection
- Manual trip entry fallback
- IRS standard mileage deduction ($0.70/mile for 2025)
- Export mileage logs as PDF or CSV in IRS-ready format

### Smart Deduction Finder
- Interactive checklist of gig-specific deductions: music & apps, passenger amenities, hardware, platform fees, cell phone (50% business use auto-calc)
- Real-time tax savings calculation as you check items

### Bank Transaction Integration
- Plaid-powered bank linking
- Auto-categorization of transactions (gas, repairs, insurance)
- One-tap expense creation from bank transactions

### Tax Filing Wizard
- 15-step guided flow: personal details, income, deductions, credits, tax summary, PDF generation
- Draft saving — resume the wizard where you left off
- Federal tax calculation with all 7 progressive brackets
- Self-employment tax (Social Security, Medicare, Additional Medicare)
- State tax calculation (full California support, estimates for other states)
- Credits: Child Tax Credit, EITC, American Opportunity Tax Credit
- Penalty risk assessment and safe harbor calculation
- 1040-style PDF generation for print and mail

### Quarterly Tax Reminders
- Automatic reminder scheduling for estimated tax deadlines
- Notifications 7 days and 1 day before each quarterly due date

### Insights & Analytics
- Monthly and weekly earnings breakdowns
- Year-over-year comparison
- Average monthly earnings and historical trend tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 + Expo 54, Expo Router |
| Language | TypeScript 5.9 |
| State | React Context, AsyncStorage |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth, Storage) |
| AI | Anthropic API (document OCR & extraction) |
| Banking | Plaid SDK |
| Payments | RevenueCat |
| Location | Expo Location + Task Manager (background GPS) |
| PDF | pdf-lib, expo-print |

## Project Structure

```
app/
├── (auth)/           # Login & signup
├── (onboarding)/     # Personal info, filing status, gig app selection
├── (tabs)/           # Main navigation
│   ├── index.tsx     # Dashboard (mileage tracking)
│   ├── earnings.tsx  # Income tracking
│   ├── expenses.tsx  # Expense management
│   ├── insights.tsx  # Analytics
│   └── settings.tsx  # Profile & preferences
├── file-now/         # 15-step tax filing wizard
├── deductions/       # Smart deduction finder
├── analysis/         # Tax calculation & estimates
└── bank/             # Plaid bank transactions

lib/                  # Tax engines, stores, services
components/           # UI components (tax forms, charts, receipts)
supabase/
├── functions/        # Edge functions (OCR, Plaid, form scanning)
└── migrations/       # Database schema
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npx expo start
```

Requires a Supabase project with migrations applied and environment variables for Supabase, Plaid, and RevenueCat configured.
