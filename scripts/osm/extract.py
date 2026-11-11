"""
Cut the businesses of one city out of a Geofabrik OpenStreetMap file. Called by build-marrakech-dataset.ts,
which owns the sector mapping; this step only does what needs a real OSM toolkit (boundary polygon, way
centres) and keeps a handful of tags per object.

  uv run --no-project --with osmium==4.3.2 --with shapely==2.2.0 python -I scripts/osm/extract.py \
      --pbf morocco-latest.osm.pbf --wikidata Q101625 --tags tags.json --out raw.json

Kept: named nodes/ways carrying one of the sector tags, inside the boundary whose wikidata matches.
Only these tags are written: names, the sector tag keys, website and explicit contact links. Phone numbers,
e-mail addresses, opening hours, addresses and everything else stay out.
"""
import argparse, json, sys

import osmium
from shapely import wkb
from shapely.geometry import Point
from shapely.prepared import prep

LINK_TAGS = ["website", "contact:website", "contact:whatsapp", "whatsapp", "contact:instagram", "instagram", "contact:facebook"]
NAME_TAGS = ["name", "brand", "operator"]

ap = argparse.ArgumentParser()
ap.add_argument("--pbf", required=True)
ap.add_argument("--wikidata", required=True)
ap.add_argument("--tags", required=True, help='JSON list of {"key","value"} sector tags')
ap.add_argument("--out", required=True)
args = ap.parse_args()

pairs = {(t["key"], t["value"]) for t in json.load(open(args.tags, encoding="utf8"))}
keys = sorted({k for k, _ in pairs})
keep = set(NAME_TAGS) | set(keys) | set(LINK_TAGS)

# 1) The city boundary: the same area the old Overpass query used (area["wikidata"=...]).
wf = osmium.geom.WKBFactory()
boundary, info = None, {}
areas = osmium.FileProcessor(args.pbf).with_areas(osmium.filter.TagFilter(("wikidata", args.wikidata)))
for a in areas.with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)):
    if a.tags.get("wikidata") != args.wikidata or a.from_way():
        continue
    g = wkb.loads(wf.create_multipolygon(a), hex=True)
    if boundary is None or g.area > boundary.area:
        boundary = g
        info = {"wikidata": args.wikidata, "relation": a.orig_id(), "name": a.tags.get("name:en") or a.tags.get("name"), "adminLevel": a.tags.get("admin_level")}
if boundary is None:
    sys.exit(f"No boundary relation with wikidata={args.wikidata} in {args.pbf}")
inside = prep(boundary)
minx, miny, maxx, maxy = boundary.bounds

# 2) Businesses inside it. Ways are placed at the average of their nodes, like Overpass "out center".
elements = []
fp = osmium.FileProcessor(args.pbf).with_locations().with_filter(osmium.filter.KeyFilter(*keys))
for o in fp.with_filter(osmium.filter.EntityFilter(osmium.osm.NODE | osmium.osm.WAY)):
    tags = {t.k: t.v for t in o.tags}
    if not any(tags.get(n) for n in NAME_TAGS) or not any((k, tags.get(k)) in pairs for k in keys):
        continue
    if o.is_node():
        lon, lat = o.location.lon, o.location.lat
    else:
        locs = [n.location for n in o.nodes if n.location.valid()]
        if not locs:
            continue
        lon, lat = sum(l.lon for l in locs) / len(locs), sum(l.lat for l in locs) / len(locs)
    if not (minx <= lon <= maxx and miny <= lat <= maxy) or not inside.contains(Point(lon, lat)):
        continue
    elements.append({"type": "node" if o.is_node() else "way", "id": o.id, "tags": {k: v for k, v in tags.items() if k in keep}})

header = osmium.io.Reader(args.pbf, osmium.osm.osm_entity_bits.NOTHING)
until = header.header().get("osmosis_replication_timestamp") or None
header.close()

json.dump({"boundary": info, "osmDataUntil": until, "elements": elements}, open(args.out, "w", encoding="utf8"), ensure_ascii=False)
print(f"{len(elements)} businesses inside {info['name']} (relation {info['relation']})")
