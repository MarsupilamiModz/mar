# XumariModz

Premium multi-game mods marketplace — GTA V / FiveM, Minecraft, ETS2, BeamNG, Assetto Corsa and more.

## Stack

- **Next.js 14** App Router · TypeScript · Tailwind · shadcn/ui
- **Supabase** Auth (email + Discord OAuth)
- **Prisma** + PostgreSQL
- **Stripe** subscriptions & purchases
- **Cloudflare R2** file storage
- **next-intl** (EN / DE)

## Quick start

```bash
npm install
cp .env.example .env.local
# Configure Supabase, DATABASE_URL, Stripe, R2, Discord

npx prisma generate
npx prisma db push
npm run db:seed

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## First admin

```sql
UPDATE "User" SET role = 'OWNER' WHERE email = 'you@example.com';
```

## Game management

Admins → **Games** → create/edit games, upload icons & banners, set SEO fields and featured status. Homepage and `/games` load from the database only (no hardcoded fallbacks).

## Stripe webhook

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## License

Proprietary — XumariModz. All rights reserved.
