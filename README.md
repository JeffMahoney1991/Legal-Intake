# LegalTriage — AI Legal Intake & Referral System

An AI-powered legal intake tool that helps people understand their legal situation, assesses case strength and urgency, and connects them with the right lawyer when the stakes justify it.

Built as a proof-of-concept for a two-sided legal marketplace: **clients** get free AI-assisted intake and triage, **lawyers** pay for qualified, organized leads.

## Architecture

The system is split into two interfaces sharing the same data layer:

### Client App (`/`)
- AI chat powered by Claude that walks users through structured legal intake
- Document upload with image/PDF analysis — the AI reads and cross-references uploaded evidence
- Case assessment with urgency, strength, stakes, and high-stakes flags (jail, licence loss, custody, etc.)
- Lawyer matching by practice area and jurisdiction, with one-click referral requests
- Case history sidebar with past conversations and documents

### Admin Panel (`/admin`)
- Lawyer network management — add lawyers with practice areas, jurisdictions, fee structures, capacity
- Case pipeline — view all submitted cases, full AI assessments, conversation transcripts, contact info
- Assign lawyers to cases, track referral status (Pending → Referred → Converted)
- Dashboard with volume by legal area, lawyer performance, conversion rates, revenue tracking
- JSON data export

## How It Works

1. User describes their situation (text or document upload)
2. AI identifies the legal area, collects key facts across 2–4 exchanges
3. AI generates a structured assessment: urgency, case strength, financial stakes, high-stakes flags
4. System matches lawyers from the referral network by area + province
5. AI recommends a specific lawyer by name and offers to connect
6. User submits contact form → case appears in admin panel with full intake package
7. Admin assigns lawyer → tracks conversion → collects referral fee

## Tech Stack

- **Frontend**: React 18 + Vite
- **AI**: Claude Sonnet 4 (Anthropic API) with structured assessment parsing
- **Storage**: localStorage (swap for a database in production)
- **Deployment**: Vercel

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/legal-triage.git
cd legal-triage
npm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get an API key at [console.anthropic.com](https://console.anthropic.com).

```bash
npm run dev
```

- Client app: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin`

## Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add `ANTHROPIC_API_KEY` in Vercel's Environment Variables settings
4. Deploy

The `vercel.json` handles SPA routing automatically.

## Key Design Decisions

- **AI does the intake, not a form.** Conversational intake gets better information than a static form because the AI asks follow-up questions based on context.
- **Structured assessment parsing.** The AI outputs a hidden assessment block that the system parses into structured data (urgency, strength, stakes, flags) — the user sees a conversational response, the system gets machine-readable triage data.
- **Two-sided value.** Clients get free help understanding their situation. Lawyers get pre-qualified leads with organized case files, not just a name and phone number.
- **Cost-benefit built in.** The system evaluates whether a lawyer is even worth it financially, and routes low-value cases to self-help guidance instead.

## Production Considerations

For a real deployment, you'd want:

- **Database** (Postgres/Supabase) instead of localStorage
- **Auth** for admin panel (lawyers shouldn't see each other's data)
- **Email notifications** when a case is referred to a lawyer
- **Stripe** for referral fee collection
- **File storage** (S3/Cloudflare R2) for uploaded documents
- **Rate limiting** on the API endpoint
- **Auth** on the proxy to prevent abuse

## License

MIT
