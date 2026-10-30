# Déploiement sur le VPS — guide pas à pas

Couvre T030, T034, T035, T036, T038, T039, T046, T047. **Rien de ce qui suit n'a été exécuté** : le code et
les fichiers (`Dockerfile`, `docker-compose.yml`, `deploy/`) sont prêts, mais ni Docker ni PostgreSQL
n'étaient disponibles pour les tester. Faire la répétition (étape 4) avant la vraie bascule.

Pile : Caddy (HTTPS) → app Next.js (conteneur) → PostgreSQL 17 (conteneur, non exposé).
Un seul dépôt et une seule app pour l'instant ; la séparation admin / vitrine vient après (voir T025–T028).

## 1. Sécuriser le VPS (T034)

```bash
adduser deploy && usermod -aG sudo,docker deploy        # utilisateur non-root
# copier votre clé : ssh-copy-id deploy@IP, puis dans /etc/ssh/sshd_config :
#   PermitRootLogin no / PasswordAuthentication no
ufw default deny incoming && ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
apt install fail2ban unattended-upgrades
```
Contrôle : `nmap IP` depuis l'extérieur ne montre que 22, 80, 443. Postgres n'a aucun `ports:` dans le Compose.
Attention : Docker contourne `ufw` pour les ports qu'il publie ; seuls Caddy (80/443) en publie.

## 2. Installer la pile (T036)

```bash
git clone <dépôt> /srv/ibda3 && cd /srv/ibda3
cp deploy/.env.example .env && nano .env      # SITE_DOMAIN, POSTGRES_PASSWORD, JWT_SECRET (32+), OWNER_USER_ID...
docker compose up -d db
docker compose --profile tools run --rm migrate    # crée le schéma complet (migration 0_init)
```

## 3. Copier les données depuis Neon (T030, T046) — lecture seule sur Neon

Neon n'est jamais modifié. Important : la base Neon est **en retard** sur `schema.prisma` (pas de table
`content_posts`, colonnes de témoignage absentes, constaté le 2026-10-30). On crée donc le schéma complet
avec `migrate`, puis on charge **les données seulement**.

```bash
# client pg_dump de version >= celle du serveur Neon
pg_dump "$NEON_URL" --data-only --no-owner -Fc -f neon-data.dump
pg_restore --data-only --disable-triggers --no-owner -d "postgresql://ibda3:...@127.0.0.1:5432/ibda3" neon-data.dump
```
(en passant par `docker compose exec -T db pg_restore ... < neon-data.dump`, la base n'écoutant pas sur l'hôte.)

Contrôle T046 : comptage par table, écart = 0 :
```sql
SELECT 'users', count(*) FROM users UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'prospects', count(*) FROM prospects UNION ALL SELECT 'leads', count(*) FROM leads;
```
à exécuter sur Neon puis sur le VPS ; puis tester une connexion admin.

Couvertures Vercel Blob (T032) : le service `migrate` monte le volume des uploads. Simulation puis écriture, **sur la base du VPS** :
```bash
docker compose --profile tools run --rm migrate npx tsx scripts/migrate-blob-covers.ts
docker compose --profile tools run --rm migrate npx tsx scripts/migrate-blob-covers.ts --apply
```
Le script refuse de tourner sur une URL Neon et peut être relancé sans risque.

## 4. Répétition (T039)

1. `docker compose up -d --build` puis ouvrir `https://SITE_DOMAIN` via un `hosts` local ou un sous-domaine de test.
2. Vérifier : accueil, portfolio, une fiche projet, blog, contact (un lead de test), connexion admin, envoi d'une couverture.
3. Lancer `deploy/backup.sh` puis **restaurer** la sauvegarde dans une base vide (la restauration doit être testée, T035).

## 5. Bascule (T039)

1. 48 h avant : baisser le TTL DNS à 300 s.
2. Geler les écritures (prévenir l'équipe : pas de saisie admin), nouveau dump Neon, restauration, contrôle T046.
3. Changer l'enregistrement DNS vers l'IP du VPS. Caddy obtient le certificat à la première requête.
4. **Garder Vercel et Neon environ 7 jours.** Retour arrière = remettre l'ancien DNS (les données saisies entre-temps
   sur le VPS ne reviennent pas sur Neon : ne pas rebasculer sans les exporter).
5. Variables à reporter depuis Vercel : `JWT_SECRET` (même valeur = les sessions admin restent valides), `OWNER_USER_ID`,
   `GOOGLE_PLACES_API_KEY`, les trois `NEXT_PUBLIC_EMAILJS_*` (ce sont des variables de **build**).

## 6. Sauvegardes (T035)

`deploy/backup.sh` : dump quotidien + archive des uploads, 14 jours conservés, copie hors serveur via `BACKUP_REMOTE`.
Cron : `15 3 * * * /srv/ibda3/deploy/backup.sh >> /var/log/ibda3-backup.log 2>&1`.

## 7. Supervision (T038)

- Surveillance externe (UptimeRobot, Better Stack...) sur `https://SITE_DOMAIN/fr` avec alerte e-mail.
- Logs : `docker compose logs -f app`. Limiter la taille : dans `/etc/docker/daemon.json`
  `{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"5"}}`.
- Garde-fous : `restart: unless-stopped` sur tous les services.

## 8. Contrôles après bascule (T047)

- `https://SITE_DOMAIN/sitemap.xml` (liens et hreflang corrects, projets présents), `/robots.txt`.
- HTTP → HTTPS, `www` → apex, certificat valide.
- Google Analytics (cookie consent), cookie `admin_token` (Secure, HttpOnly), connexion admin.
- Les pages publiques sont rendues à chaque requête : une modification admin apparaît tout de suite.
- Envoi d'une couverture : l'image s'affiche sur `/uploads/projects/...` (servie par l'app, pas par Caddy).

## À connaître

- L'image Docker est construite en mode `standalone` (`NEXT_OUTPUT=standalone`) : testé en local (accueil, portfolio,
  sitemap, uploads, garde `/admin`), mais **le build Docker lui-même n'a pas été exécuté**.
- Le rôle PostgreSQL en lecture seule (`deploy/postgres-readonly-role.sql`) ne servira qu'après la séparation des dépôts :
  tant que la vitrine reste dans la même app que l'admin, elle a besoin d'écrire (formulaire de contact).
- La limite de débit est en mémoire (par processus) : correcte avec un seul conteneur, remise à zéro à chaque redémarrage.
