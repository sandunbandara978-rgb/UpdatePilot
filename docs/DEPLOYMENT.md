# UpdatePilot — Vercel & Production Deployment Guide

## 1. Architecture Overview
UpdatePilot is designed specifically for zero-maintenance serverless hosting on **Vercel** combined with a managed PostgreSQL database (such as **Neon**, **Supabase**, or **Vercel Postgres**), alongside locally distributed Windows desktop agents.

```mermaid
graph TD
    Client[Web Browser] -->|HTTPS| VercelEdge[Vercel Serverless Platform]
    VercelEdge -->|App Router & API Routes| NextServer[Next.js Serverless Function]
    NextServer -->|Connection Pooling| ManagedPG[(Managed PostgreSQL: Neon / Supabase)]
    
    Agent[Windows Desktop Agent] -->|Outbound HTTPS /api/v1/agent/*| VercelEdge
```

---

## 2. Prerequisites
1. **GitHub Repository:** Push this repository to GitHub.
2. **Managed PostgreSQL Provider:**
   - [Neon Serverless Postgres](https://neon.tech) (Recommended, generous free tier)
   - Or [Supabase Database](https://supabase.com)
   - Or Vercel Postgres integration
3. **Vercel Account:** Free or Pro tier.

---

## 3. Step-by-Step Vercel Deployment

### Step 1: Connect Git Repository to Vercel
1. Log into your Vercel Dashboard and click **Add New Project**.
2. Import the `UpdatePilot` Git repository.
3. Configure the Root Directory:
   - If using monorepo workspace: Set **Root Directory** to `apps/web`.
   - Ensure the Build Command is `npm run build` and Output Directory is `.next`.

### Step 2: Configure Production Environment Variables
In the Vercel Project Settings under **Environment Variables**, add:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL pooled connection string with SSL | `postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/updatepilot?sslmode=require` |
| `SESSION_SECRET` | Cryptographic secret for signing tokens | High-entropy 32-byte string (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | The production URL of your Vercel deployment | `https://updatepilot.vercel.app` |
| `PAIRING_CODE_TTL_MINUTES` | Lifetime of agent pairing codes | `10` |

### Step 3: Run Database Migrations
Run Prisma migrations against your production database instance:
```bash
npx prisma migrate deploy
```

### Step 4: Deploy & Verify
1. Click **Deploy**. Vercel will build the frontend pages and serverless API route handlers.
2. Verify production endpoints:
   - Check `https://your-domain.vercel.app/api/v1/dashboard` returns `{ success: true, data: { ... } }`.
   - Access the dashboard in your browser.
   - Click "Connect Agent" to generate a pairing code.
   - Run the agent pointing to your deployed domain:
     ```powershell
     .\UpdatePilot-Agent.ps1 pair -Code UP-XXXXXX -Server https://your-domain.vercel.app
     ```
