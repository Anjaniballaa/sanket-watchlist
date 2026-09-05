# Sanket

Smart Market Watchlist for **Code, by Groww**. A significance engine — not a price ticker.

## Local

```bash
npm install
npm run db:schema
npm run dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` first.

## Render (production)

1. Push this folder to GitHub (this directory is the repo root).
2. [dashboard.render.com](https://dashboard.render.com) → New → Web Service → connect the repo.
3. Settings:
   - Runtime: Node
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Instance: Free
4. Environment: paste every key from `.env.local`, then set
   - `NEXTAUTH_URL` and `AUTH_URL` to `https://<your-service>.onrender.com`
   - `AUTH_TRUST_HOST=true`
5. Google Cloud → OAuth client → Authorized redirect URI  
   `https://<your-service>.onrender.com/api/auth/callback/google`
6. Deploy. First boot on the free tier can take 2–3 minutes (and sleeps after idle).
