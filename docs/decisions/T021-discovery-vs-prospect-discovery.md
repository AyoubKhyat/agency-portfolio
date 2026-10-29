# T021 — `discovery` vs `prospect-discovery`

**Décision : on garde les deux pages, on ne les fusionne pas.**

| | `/admin/discovery` ("Find New") | `/admin/prospect-discovery` |
|---|---|---|
| Entrée | une phrase libre ("hotels in Marrakech") | secteur + ville structurés |
| Traitement | pipeline `lib/discovery/` : recherche, vérification des contacts, audit IA, brouillon de message | recherche + détection de doublons (EXISTS / POSSIBLE / NEW), import |
| Extras | débogage de pipeline, prévisualisation | campagnes, balayages (sweeps), couverture, cibles, suggestions IA |
| API | `api/admin/discovery/{search,preview,import}` | `api/admin/prospect-discovery/{search,import,campaigns,coverage,sectors,sweeps,targets,ai-suggest}` |
| Visibilité | menu principal (Focus Mode) | masquée en Focus Mode ; liens depuis city-comparison, saturation, outreach |

**Pourquoi pas de fusion :** les modèles de données (campagnes, sweeps, couverture) et les
parcours sont différents ; fusionner deux pages de ~900 lignes sans avoir validé l'usage réel
(T009) serait un risque sans gain.

**Reste à faire (hors périmètre) :** les deux ont chacune un `search` et un `import` ;
`lib/discovery-providers.ts` et `lib/discovery/` pourraient partager leurs fournisseurs
(OSM, Google). À traiter si l'une des deux pages est abandonnée après T009.
