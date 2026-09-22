#!/usr/bin/env python3
"""
playground_prospector.py — build a call list of businesses and institutions that
have a playground on site, using only open data (OpenStreetMap).

Why OSM and not Google Maps: the Google Maps Platform terms forbid exporting or
warehousing Places content. Place IDs may be stored indefinitely and coordinates
cached for 30 days; names, phone numbers and the rest must be fetched live and
displayed with attribution, never saved to a file like this one. OSM's ODbL data
carries no such restriction — attribute "© OpenStreetMap contributors" wherever
you publish it.

What it does:
  1. Geocodes the area you name (Nominatim).
  2. Pulls every leisure=playground in that radius (Overpass).
  3. Pulls candidate site owners nearby — schools, childcare, churches, parks,
     apartment complexes, restaurants, gyms, campgrounds, hotels.
  4. Matches each playground to its owner: point-in-polygon first, then nearest
     centroid within a distance cutoff.
  5. Writes a CSV with a satellite-view link per row so you can eyeball each one
     before you dial.

Usage:
  python3 playground_prospector.py --place "Provo, Utah" --radius-km 15
  python3 playground_prospector.py --bbox 40.15,-111.75,40.35,-111.55
  python3 playground_prospector.py --place "Boise, Idaho" --types school,childcare

Requires: requests  (pip install requests)
"""

import argparse
import csv
import math
import sys
import time

import requests

NOMINATIM = "https://nominatim.openstreetmap.org/search"
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]

# Set this to something identifying — both APIs are free, volunteer-run, and will
# rate-limit or block a generic user agent. Put a real contact address in it.
USER_AGENT = "playground-prospector/1.0 (contact: you@example.com)"

# OSM tag -> (human label, why you care)
OWNER_TAGS = {
    "childcare": ('amenity="childcare"', "Daycare"),
    "kindergarten": ('amenity="kindergarten"', "Preschool / Pre-K"),
    "school": ('amenity="school"', "School"),
    "church": ('amenity="place_of_worship"', "Place of worship"),
    "park": ('leisure="park"', "Park (municipal / HOA)"),
    "apartments": ('building="apartments"', "Apartment community"),
    "restaurant": ('amenity="fast_food"', "Restaurant"),
    "gym": ('leisure="fitness_centre"', "Gym / fitness"),
    "campground": ('tourism="camp_site"', "Campground / RV park"),
    "hotel": ('tourism="hotel"', "Hotel"),
    "community": ('amenity="community_centre"', "Community centre"),
}

DEFAULT_TYPES = ",".join(OWNER_TAGS)


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def geocode(place):
    r = requests.get(
        NOMINATIM,
        params={"q": place, "format": "json", "limit": 1},
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    r.raise_for_status()
    hits = r.json()
    if not hits:
        sys.exit(f"Could not geocode {place!r}. Try a more specific place name.")
    hit = hits[0]
    log(f"  matched: {hit['display_name']}")
    return float(hit["lat"]), float(hit["lon"])


def bbox_around(lat, lon, radius_km):
    """Square bbox in degrees. Longitude degrees shrink with latitude."""
    dlat = radius_km / 111.32
    dlon = radius_km / (111.32 * max(math.cos(math.radians(lat)), 0.01))
    return (lat - dlat, lon - dlon, lat + dlat, lon + dlon)


def overpass(query):
    """Try each mirror; Overpass nodes go down and rate-limit routinely."""
    last = None
    for url in OVERPASS_MIRRORS:
        for attempt in range(3):
            try:
                r = requests.post(
                    url,
                    data={"data": query},
                    headers={"User-Agent": USER_AGENT},
                    timeout=300,
                )
                if r.status_code in (429, 504):
                    wait = 10 * (attempt + 1)
                    log(f"  {url} busy ({r.status_code}), waiting {wait}s")
                    time.sleep(wait)
                    continue
                r.raise_for_status()
                return r.json()["elements"]
            except Exception as exc:  # noqa: BLE001 - mirrors fail in many ways
                last = exc
                log(f"  {url} failed: {exc}")
                time.sleep(5)
    sys.exit(f"All Overpass mirrors failed. Last error: {last}")


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def point_in_ring(lat, lon, ring):
    """Ray casting. ring is [{'lat':..,'lon':..}, ...]."""
    inside = False
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        if (a["lat"] > lat) != (b["lat"] > lat):
            x = (b["lon"] - a["lon"]) * (lat - a["lat"]) / (b["lat"] - a["lat"]) + a["lon"]
            if lon < x:
                inside = not inside
    return inside


def centroid(el):
    if "center" in el:
        return el["center"]["lat"], el["center"]["lon"]
    if "lat" in el:
        return el["lat"], el["lon"]
    geom = el.get("geometry") or []
    if geom:
        return (
            sum(p["lat"] for p in geom) / len(geom),
            sum(p["lon"] for p in geom) / len(geom),
        )
    return None


def street_address(tags):
    parts = [
        " ".join(p for p in (tags.get("addr:housenumber"), tags.get("addr:street")) if p),
        tags.get("addr:city"),
        tags.get("addr:state"),
        tags.get("addr:postcode"),
    ]
    return ", ".join(p for p in parts if p)


def fetch_playgrounds(bbox):
    b = ",".join(f"{v:.6f}" for v in bbox)
    q = f"""
    [out:json][timeout:180];
    (
      node["leisure"="playground"]({b});
      way["leisure"="playground"]({b});
      relation["leisure"="playground"]({b});
    );
    out center tags;
    """
    return overpass(q)


def fetch_owners(bbox, types):
    b = ",".join(f"{v:.6f}" for v in bbox)
    clauses = []
    for t in types:
        sel = OWNER_TAGS[t][0]
        clauses.append(f'  node[{sel}]({b});')
        clauses.append(f'  way[{sel}]({b});')
        clauses.append(f'  relation[{sel}]({b});')
    q = f"""
    [out:json][timeout:300];
    (
{chr(10).join(clauses)}
    );
    out geom tags;
    """
    elements = overpass(q)
    # Tag each element with the first type whose selector it satisfies.
    for el in elements:
        tags = el.get("tags", {})
        for t in types:
            key, val = OWNER_TAGS[t][0].split("=")
            if tags.get(key) == val.strip('"'):
                el["_type"] = t
                break
        else:
            el["_type"] = "other"
    return elements


def match(playground, owners, max_m):
    """Containment beats proximity; among contained, the smallest polygon wins."""
    pc = centroid(playground)
    if not pc:
        return None, None, None
    plat, plon = pc

    contained = []
    nearest, nearest_d = None, float("inf")

    for owner in owners:
        geom = owner.get("geometry")
        if geom and len(geom) > 2 and point_in_ring(plat, plon, geom):
            lats = [p["lat"] for p in geom]
            lons = [p["lon"] for p in geom]
            span = (max(lats) - min(lats)) * (max(lons) - min(lons))
            contained.append((span, owner))
            continue
        oc = centroid(owner)
        if not oc:
            continue
        d = haversine_m(plat, plon, oc[0], oc[1])
        if d < nearest_d:
            nearest, nearest_d = owner, d

    if contained:
        contained.sort(key=lambda x: x[0])
        return contained[0][1], 0.0, "on site (inside property boundary)"
    if nearest and nearest_d <= max_m:
        return nearest, nearest_d, f"nearby ({nearest_d:.0f} m) — verify"
    return None, None, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--place", help='e.g. "Provo, Utah"')
    src.add_argument("--bbox", help="south,west,north,east in decimal degrees")
    ap.add_argument("--radius-km", type=float, default=15.0, help="with --place (default 15)")
    ap.add_argument("--types", default=DEFAULT_TYPES, help=f"comma-separated: {DEFAULT_TYPES}")
    ap.add_argument("--max-distance-m", type=float, default=200.0,
                    help="how far a playground can sit from an unenclosed owner (default 200)")
    ap.add_argument("--named-only", action="store_true",
                    help="drop rows where the owner has no name — usually public parks")
    ap.add_argument("--out", default="playground_prospects.csv")
    args = ap.parse_args()

    types = [t.strip() for t in args.types.split(",") if t.strip()]
    unknown = [t for t in types if t not in OWNER_TAGS]
    if unknown:
        sys.exit(f"Unknown type(s): {', '.join(unknown)}. Valid: {DEFAULT_TYPES}")

    if args.bbox:
        bbox = tuple(float(v) for v in args.bbox.split(","))
        if len(bbox) != 4:
            sys.exit("--bbox needs exactly four numbers: south,west,north,east")
    else:
        log(f"Geocoding {args.place!r}...")
        lat, lon = geocode(args.place)
        time.sleep(1)  # Nominatim asks for max 1 request/second
        bbox = bbox_around(lat, lon, args.radius_km)
    log(f"Bounding box: {bbox}")

    log("Fetching playgrounds...")
    playgrounds = fetch_playgrounds(bbox)
    log(f"  {len(playgrounds)} playgrounds")
    if not playgrounds:
        sys.exit("No playgrounds found. Widen the radius or check the area.")

    log(f"Fetching candidate sites ({', '.join(types)})...")
    owners = fetch_owners(bbox, types)
    log(f"  {len(owners)} candidate sites")

    rows = []
    for pg in playgrounds:
        owner, dist, basis = match(pg, owners, args.max_distance_m)
        if not owner:
            continue
        otags = owner.get("tags", {})
        ptags = pg.get("tags", {})
        name = otags.get("name") or otags.get("operator") or ""
        if args.named_only and not name:
            continue
        pc = centroid(pg)
        rows.append({
            "prospect_name": name,
            "site_type": OWNER_TAGS.get(owner.get("_type"), ("", "Unknown"))[1],
            "address": street_address(otags),
            "phone": otags.get("phone") or otags.get("contact:phone") or "",
            "website": otags.get("website") or otags.get("contact:website") or "",
            "operator": otags.get("operator", ""),
            "match_basis": basis,
            "playground_surface": ptags.get("surface", ""),
            "playground_access": ptags.get("access", ""),
            "playground_name": ptags.get("name", ""),
            "lat": f"{pc[0]:.6f}",
            "lon": f"{pc[1]:.6f}",
            "satellite_view": f"https://www.google.com/maps/@{pc[0]:.6f},{pc[1]:.6f},19z/data=!3m1!1e3",
            "street_view": f"https://www.google.com/maps?q&layer=c&cbll={pc[0]:.6f},{pc[1]:.6f}",
            "osm_link": f"https://www.openstreetmap.org/{pg['type']}/{pg['id']}",
        })

    # Named prospects first, then by type — that's roughly call order.
    rows.sort(key=lambda r: (not r["prospect_name"], r["site_type"], r["prospect_name"]))

    if not rows:
        sys.exit("No playgrounds matched a candidate site. Try --max-distance-m 400.")

    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    log(f"\nWrote {len(rows)} prospects to {args.out}")
    by_type = {}
    for r in rows:
        by_type[r["site_type"]] = by_type.get(r["site_type"], 0) + 1
    for t, n in sorted(by_type.items(), key=lambda x: -x[1]):
        log(f"  {n:4d}  {t}")
    log(f"  {sum(1 for r in rows if r['phone']):4d}  have a phone number in OSM")
    log("\nData © OpenStreetMap contributors, ODbL. Attribute it if you publish it.")


if __name__ == "__main__":
    main()
