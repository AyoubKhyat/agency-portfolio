# Migrations

`0_init` is the baseline generated from `schema.prisma` (offline, `prisma migrate diff --from-empty`).
It creates the whole schema, so it applies to an **empty** database only.

- **New database (VPS):** `npm run db:migrate` creates everything, then load the data (data-only dump).
- **Database that already has the tables (Neon, a restored full dump):**
  `npx prisma migrate resolve --applied 0_init`, never `migrate deploy` on it.
- **Next schema changes:** `npx prisma migrate dev --name <change>` locally, commit the folder,
  `npm run db:migrate` on the server. No more `db push`.

Note (2026-10-30): the Neon production database was behind `schema.prisma` (no `content_posts`
table, testimonial columns missing). Check `npm run db:diff` before relying on it.
