# T023 — Contrat vitrine ↔ admin (état réel du code, 2026-10-30)

Tout ce que la partie publique lit ou écrit dans la base, et ce qui touche encore à l'admin.

## Lectures publiques (vitrine → base)

| Besoin | Où | Fonction / table |
|---|---|---|
| Accueil : projets, témoignages | `components/home-v2/HomeV2.tsx` | `getHomepageProjects`, `getPublishedTestimonials` (`dal/projects.ts`) |
| Portfolio | `components/portfolio-v2/PortfolioV2.tsx` | `getPortfolioProjects` |
| Fiche projet | `app/[locale]/portfolio/[slug]/page.tsx`, `ProjectDetailV2.tsx` | `getProjectBySlug`, `getPortfolioProjects` |
| Sitemap | `app/sitemap.ts` | `getAllProjectSlugs` + `lib/blog.ts` |
| Blog | `lib/blog.ts` | fichiers `content/blog/{fr,en,ar}` **et** table `BlogPost` (Prisma direct) |
| Anciennes versions | `components/*-legacy/` | `getVisibleProjects` (à supprimer avec T006) |

Tables lues : `projects`, `project_translations`, `blog_posts` (publiées uniquement).
Aucune autre table n'est nécessaire côté vitrine : c'est la liste du rôle Postgres en lecture seule (T033).

## Écritures publiques

| Route | Effet | Dépendances admin |
|---|---|---|
| `POST /api/contact` | crée un `Lead`, attribue au moins chargé, déduplique | `createLead`, `findRecentDuplicateLead`, `getLeastLoadedUser` (lit `users`), `dispatchWebhook`, `notifyNewLead` |
| `POST /api/contact/notification-status` | met à jour l'état de notification d'un lead | `leads` |
| `/sign/[token]` + `/api/sign/[token]` | signature publique d'un contrat (jeton signé, 7 j) | `contracts`, `lib/auth.ts` (jeton `contractSign`) |

Ces trois-là sont du domaine admin exposé au public : ils partent avec l'admin (T025, T026).

## Constats

- La vitrine n'écrit que par `/api/contact` et `/api/sign` : tout le reste est en lecture.
- `chat-ai.ts` n'est appelé que par `api/admin/chat/.../messages` : purement admin.
- `lib/blog.ts` est le seul module public qui appelle Prisma sans passer par le DAL.
- `lib/auth.ts` sert les deux côtés (jeton de signature de contrat).

## Décision T024 (source des articles)

Les fichiers MDX de `content/blog` sont en lecture seule (aucun code ne les écrit). L'admin écrit
uniquement dans `BlogPost`. **Chemin d'écriture unique : la base.** Les MDX restent comme contenu
historique, lu par la vitrine ; ils pourront être importés en base plus tard sans changer l'API.
