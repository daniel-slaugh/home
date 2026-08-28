#!/usr/bin/env python3
"""
hydro_login_bg.py
=================

Build a stunning, themeable SVG "map" background for the HydroServer login /
signup page out of *real* public hydrography + terrain data.

Pipeline
--------
1. Pick a center (lat, lon) + slippy `zoom` + output pixel size.  That defines a
   Web-Mercator bounding box -- exactly the way a map tile would.
2. WATER          -- USGS NHD (National Hydrography Dataset): lakes / reservoirs,
                     rivers, streams, canals.
3. TERRAIN        -- USGS elevation contours (The National Map "contours"
                     service).  Index + intermediate lines so mountains read.
4. WATERSHEDS     -- USGS WBD (Watershed Boundary Dataset) HUC polygons, drawn as
                     dashed boundary lines.
5. COMPOSE        -- reproject every geometry into SVG pixel space, simplify, and
                     emit:
                       out/01_water.geojson  02_contours.geojson  03_watersheds.geojson
                       out/layer_water.svg   layer_contours.svg   layer_watersheds.svg
                       out/background.svg    <- the deliverable (CSS-var themeable)
                       out/preview.html      <- login mock + live color controls
                       out/manifest.json

Everything is cached in out/cache/ keyed by the request, so re-running to tweak
styling is instant and offline.  Delete out/cache/ or pass --refresh to refetch.

Deps: requests, numpy (numpy only used for Douglas-Peucker; optional).

Examples
--------
    python hydro_login_bg.py                       # default preset (Deer Creek, UT)
    python hydro_login_bg.py --preset jordanelle
    python hydro_login_bg.py --lat 44.46 --lon -110.57 --zoom 12   # Yellowstone L.
    python hydro_login_bg.py --preset deer-creek --auto-center --contour-step 2
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urlencode

import requests

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
CACHE = HERE / "out" / "cache"      # shared across locations; keyed by request

# --------------------------------------------------------------------------- #
# Presets: (lat, lon, zoom).  Water body roughly centered, mountains around.
# --------------------------------------------------------------------------- #
PRESETS: dict[str, tuple[float, float, int]] = {
    "deer-creek":   (40.4143, -111.5124, 13),   # Deer Creek Reservoir, Wasatch UT
    "jordanelle":   (40.6110, -111.4290, 13),   # Jordanelle Reservoir, UT
    "pineview":     (41.2540, -111.8480, 13),   # Pineview Reservoir, UT
    "bear-lake":    (41.9500, -111.3300, 11),   # Bear Lake, UT/ID
    "yellowstone":  (44.4600, -110.5700, 11),   # Yellowstone Lake, WY
    "tahoe":        (39.0968, -120.0324, 11),   # Lake Tahoe, CA/NV
    "crater-lake":  (42.9446, -122.1090, 12),   # Crater Lake, OR
    "powell":       (37.0700, -111.2400, 11),   # Lake Powell (Wahweap), UT/AZ
    "great-salt-lake": (41.1700, -112.5700, 10), # Great Salt Lake, UT (huge, flat)
}

# --------------------------------------------------------------------------- #
# ArcGIS REST endpoints (all public, no key).  layer ids verified 2026-08.
# --------------------------------------------------------------------------- #
NHD = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer"
CONTOURS = "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer"
WBD = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer"

NHD_WATERBODY = 12   # Waterbody - Large Scale   (polygons: lakes, reservoirs)
NHD_AREA = 9         # Area - Large Scale        (polygons: wide rivers)
NHD_FLOWLINE = 6     # Flowline - Large Scale    (lines: rivers, streams, canals)
CONTOUR_INDEX = 25   # Normal Index Contours     (every ~200 ft, heavier)
CONTOUR_INTER = 26   # Normal Intermediate Contours (every ~40 ft)

# NHD fcodes we care about (for dashing intermittent water, etc.)
FCODE_INTERMITTENT = {46003, 46007}          # intermittent / ephemeral stream
FCODE_CANAL = {33600, 33601, 33603}          # canal / ditch
FCODE_SKIP_FLOW = {55800, 33400}             # artificial path / connector (lake fillers)
WATERBODY_MARSH = {46600, 46601, 46602}      # swamp / marsh -> lighter


# --------------------------------------------------------------------------- #
# Slippy-map / Web-Mercator projection
# --------------------------------------------------------------------------- #
def lonlat_to_world(lon: float, lat: float) -> tuple[float, float]:
    """Normalized world coordinates in [0, 1] (top-left origin), zoom-independent."""
    x = (lon + 180.0) / 360.0
    s = math.sin(math.radians(lat))
    s = min(max(s, -0.9999), 0.9999)
    y = 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)
    return x, y


def world_to_lonlat(x: float, y: float) -> tuple[float, float]:
    lon = x * 360.0 - 180.0
    n = math.pi - 2.0 * math.pi * y
    lat = math.degrees(math.atan(math.sinh(n)))
    return lon, lat


@dataclass
class Frame:
    """The Web-Mercator viewport: pixel size + geographic bbox + projector."""
    lat: float
    lon: float
    zoom: int
    width: int
    height: int
    # filled in __post_init__
    world_x0: float = 0.0
    world_y0: float = 0.0
    scale: float = 0.0          # world units per pixel
    west: float = 0.0
    south: float = 0.0
    east: float = 0.0
    north: float = 0.0

    def __post_init__(self) -> None:
        cx, cy = lonlat_to_world(self.lon, self.lat)
        self.scale = 1.0 / (256.0 * (2 ** self.zoom))
        self.world_x0 = cx - (self.width / 2) * self.scale
        self.world_y0 = cy - (self.height / 2) * self.scale
        self.west, self.north = world_to_lonlat(self.world_x0, self.world_y0)
        self.east, self.south = world_to_lonlat(
            self.world_x0 + self.width * self.scale,
            self.world_y0 + self.height * self.scale,
        )

    @property
    def bbox(self) -> str:
        return f"{self.west},{self.south},{self.east},{self.north}"

    @property
    def deg_per_px(self) -> float:
        return abs(self.east - self.west) / self.width

    def project(self, lon: float, lat: float) -> tuple[float, float]:
        wx, wy = lonlat_to_world(lon, lat)
        return ((wx - self.world_x0) / self.scale, (wy - self.world_y0) / self.scale)


# --------------------------------------------------------------------------- #
# ArcGIS querying (cached, paged)
# --------------------------------------------------------------------------- #
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "hydro-login-bg/1.0 (+personal-site tool)"


def _cache_path(tag: str, params: dict) -> Path:
    key = hashlib.sha1(urlencode(sorted(params.items())).encode()).hexdigest()[:16]
    return CACHE / f"{tag}_{key}.json"


def arcgis_query(
    service: str,
    layer: int,
    frame: Frame,
    *,
    tag: str,
    where: str = "1=1",
    out_fields: str = "*",
    refresh: bool = False,
    max_offset_pages: int = 20,
    offset_px: float = 1.2,
) -> dict:
    """Return a GeoJSON FeatureCollection for `layer` clipped to `frame.bbox`.

    `maxAllowableOffset` makes the server generalize geometry to ~`offset_px`
    screen pixels before sending -- without it a wide frame (a big lake) pulls
    down hundreds of MB of contour vertices.
    """
    base_params = dict(
        geometry=frame.bbox,
        geometryType="esriGeometryEnvelope",
        inSR="4326",
        outSR="4326",
        spatialRel="esriSpatialRelIntersects",
        where=where,
        outFields=out_fields,
        returnGeometry="true",
        geometryPrecision="5",
        maxAllowableOffset=f"{frame.deg_per_px * offset_px:.8f}",
        f="geojson",
    )
    cache_file = _cache_path(tag, {**base_params, "svc": service, "layer": layer})
    if cache_file.exists() and not refresh:
        return json.loads(cache_file.read_text())

    url = f"{service}/{layer}/query"
    features: list[dict] = []
    offset = 0
    for _ in range(max_offset_pages):
        params = dict(base_params, resultOffset=offset, resultRecordCount=2000)
        data = _get_json(url, params)
        if "error" in data:
            raise RuntimeError(f"{tag}: ArcGIS error {data['error']}")
        chunk = data.get("features", [])
        features.extend(chunk)
        if not data.get("exceededTransferLimit") or not chunk:
            break
        offset += len(chunk)

    fc = {"type": "FeatureCollection", "features": features,
          "_meta": {"service": service, "layer": layer, "bbox": frame.bbox,
                    "count": len(features)}}
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(fc))
    return fc


def _get_json(url: str, params: dict, retries: int = 4) -> dict:
    last = None
    for attempt in range(retries):
        try:
            r = SESSION.get(url, params=params, timeout=90)
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"GET failed {url}: {last}")


# --------------------------------------------------------------------------- #
# Geometry -> pixel polylines
# --------------------------------------------------------------------------- #
Ring = list[tuple[float, float]]


def _iter_lines(geom: dict) -> Iterable[Sequence[Sequence[float]]]:
    t = geom["type"]
    c = geom["coordinates"]
    if t == "LineString":
        yield c
    elif t == "MultiLineString":
        yield from c
    elif t == "Polygon":
        yield from c
    elif t == "MultiPolygon":
        for poly in c:
            yield from poly


def project_feature(feat: dict, frame: Frame) -> list[Ring]:
    geom = feat.get("geometry")
    if not geom:
        return []
    out: list[Ring] = []
    for line in _iter_lines(geom):
        pts = [frame.project(pt[0], pt[1]) for pt in line]
        if len(pts) >= 2:
            out.append(pts)
    return out


def simplify_ring(points: Ring, eps: float, closed: bool = False) -> Ring:
    """RDP for open polylines; split-at-farthest RDP for closed rings.

    Plain RDP anchors on the first and last vertex -- for a closed ring those
    coincide, the baseline degenerates, and the whole ring collapses to a point.
    So for rings we cut at the vertex farthest from the start and simplify the
    two arcs independently.
    """
    if eps <= 0 or len(points) < 4:
        return points
    if not closed:
        return rdp(points, eps)
    x0, y0 = points[0]
    far = max(range(1, len(points)),
              key=lambda i: (points[i][0] - x0) ** 2 + (points[i][1] - y0) ** 2)
    a = rdp(points[:far + 1], eps)
    b = rdp(points[far:], eps)
    return a[:-1] + b


def rdp(points: Ring, eps: float) -> Ring:
    """Ramer-Douglas-Peucker simplification in pixel space (iterative)."""
    if len(points) < 3 or eps <= 0:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        lo, hi = stack.pop()
        ax, ay = points[lo]
        bx, by = points[hi]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-9
        dmax, idx = 0.0, -1
        for i in range(lo + 1, hi):
            px, py = points[i]
            d = abs(dx * (ay - py) - (ax - px) * dy) / norm
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps and idx != -1:
            keep[idx] = True
            stack.append((lo, idx))
            stack.append((idx, hi))
    return [p for p, k in zip(points, keep) if k]


def clip_visible(rings: list[Ring], frame: Frame, pad: float = 40.0) -> list[Ring]:
    """Drop rings entirely outside the padded viewport (cheap bbox test)."""
    out = []
    for r in rings:
        xs = [p[0] for p in r]
        ys = [p[1] for p in r]
        if max(xs) < -pad or min(xs) > frame.width + pad:
            continue
        if max(ys) < -pad or min(ys) > frame.height + pad:
            continue
        out.append(r)
    return out


def polyline_len(ring: Ring) -> float:
    return sum(math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1])
              for i in range(len(ring) - 1))


def path_d(ring: Ring, close: bool = False, prec: int = 1) -> str:
    fmt = f"{{:.{prec}f}},{{:.{prec}f}}"
    d = "M" + " L".join(fmt.format(x, y) for x, y in ring)
    return d + ("Z" if close else "")


# --------------------------------------------------------------------------- #
# Layer builders  ->  list of <path .../> strings
# --------------------------------------------------------------------------- #
@dataclass
class LayerBundle:
    contours_index: list[str] = field(default_factory=list)
    contours_inter: list[str] = field(default_factory=list)
    watersheds: list[str] = field(default_factory=list)
    streams: list[str] = field(default_factory=list)
    streams_intermittent: list[str] = field(default_factory=list)
    canals: list[str] = field(default_factory=list)
    waterbodies: list[str] = field(default_factory=list)
    waterbodies_marsh: list[str] = field(default_factory=list)
    counts: dict = field(default_factory=dict)


def build_contours(frame: Frame, fc_index: dict, fc_inter: dict,
                   contour_step: int, simplify: float,
                   min_px: float) -> tuple[list[str], list[str]]:
    def emit(fc: dict, keep_every: int, floor_px: float) -> list[str]:
        paths = []
        for feat in fc["features"]:
            elev = feat.get("properties", {}).get("contourelevation")
            if keep_every > 1 and elev is not None:
                # keep only every Nth 40-ft band
                if int(round(elev / 40.0)) % keep_every != 0:
                    continue
            rings = clip_visible(project_feature(feat, frame), frame)
            for ring in rings:
                if polyline_len(ring) < floor_px:
                    continue
                ring = rdp(ring, simplify * 1.3)   # contours tolerate coarser lines
                if len(ring) >= 2:
                    paths.append(f'<path d="{path_d(ring, prec=0)}"/>')
        return paths

    idx = emit(fc_index, 1, min_px)
    inter = emit(fc_inter, max(1, contour_step), min_px * 1.6)
    return idx, inter


def build_watersheds(frame: Frame, fc: dict, simplify: float) -> list[str]:
    paths = []
    for feat in fc["features"]:
        for ring in clip_visible(project_feature(feat, frame), frame):
            ring = simplify_ring(ring, simplify, closed=True)
            if len(ring) >= 2:
                paths.append(f'<path d="{path_d(ring, close=True, prec=0)}"/>')
    return paths


def build_flowlines(frame: Frame, fc: dict, simplify: float, min_px: float = 0.0
                    ) -> tuple[list[str], list[str], list[str]]:
    perennial, intermittent, canal = [], [], []
    for feat in fc["features"]:
        props = feat.get("properties", {})
        fcode = props.get("fcode") or 0
        if fcode in FCODE_SKIP_FLOW:
            continue
        named = bool(props.get("gnis_name"))
        bucket = perennial
        if fcode in FCODE_INTERMITTENT:
            bucket = intermittent
        elif fcode in FCODE_CANAL:
            bucket = canal
        parts = clip_visible(project_feature(feat, frame), frame)
        if min_px and not named and sum(polyline_len(p) for p in parts) < min_px:
            continue  # drop short unnamed fragments (keeps named rivers whole)
        for ring in parts:
            ring = rdp(ring, simplify)
            if len(ring) >= 2:
                bucket.append(f'<path d="{path_d(ring)}"/>')
    return perennial, intermittent, canal


def build_waterbodies(frame: Frame, *fcs: dict, simplify: float, min_px: float = 0.0
                      ) -> tuple[list[str], list[str]]:
    solid, marsh = [], []
    for fc in fcs:
        for feat in fc["features"]:
            fcode = feat.get("properties", {}).get("fcode") or 0
            rings = clip_visible(project_feature(feat, frame), frame)
            rings = [simplify_ring(r, simplify, closed=True) for r in rings if len(r) >= 4]
            rings = [r for r in rings if len(r) >= 3]
            if not rings:
                continue
            if min_px:
                xs = [p[0] for r in rings for p in r]
                ys = [p[1] for r in rings for p in r]
                if math.hypot(max(xs) - min(xs), max(ys) - min(ys)) < min_px:
                    continue  # drop ponds smaller than min_px across
            d = " ".join(path_d(r, close=True) for r in rings)
            (marsh if fcode in WATERBODY_MARSH else solid).append(
                f'<path fill-rule="evenodd" d="{d}"/>')
    return solid, marsh


# --------------------------------------------------------------------------- #
# SVG assembly
# --------------------------------------------------------------------------- #
def _svg_open(frame: Frame, extra: str = "") -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {frame.width} {frame.height}" '
            f'preserveAspectRatio="xMidYMid slice" {extra}>')


def write_layer_preview(name: str, frame: Frame, groups: list[tuple[str, str, list[str]]]) -> Path:
    """Standalone SVG for one pipeline stage, plain styling, for eyeballing."""
    body = [f'<rect width="{frame.width}" height="{frame.height}" fill="#0d1b2a"/>']
    for _label, style, paths in groups:
        if not paths:
            continue
        body.append(f'<g {style}>{"".join(paths)}</g>')
    svg = _svg_open(frame) + "".join(body) + "</svg>"
    p = OUT / f"layer_{name}.svg"
    p.write_text(svg)
    return p


BACKGROUND_STYLE = """
  <style>
    /* THEME HOOKS: minimal = set --hlb-bg and --hlb-ink. Granular = override
       --hlb-water / --hlb-contour / --hlb-watershed and the opacity/width knobs.
       Inline this SVG in your markup so the CSS variables reach it. */
    .hlb-root {
      --hlb-bg: #eef4f7;
      --hlb-ink: #93a9b8;
      --hlb-water: #3f7fae;
      --hlb-contour: var(--hlb-ink);
      --hlb-watershed: var(--hlb-ink);

      --hlb-contour-opacity: .34;
      --hlb-index-opacity: .55;
      --hlb-watershed-opacity: .5;
      --hlb-stream-opacity: .9;
      --hlb-waterbody-fill-opacity: .38;

      --hlb-contour-width: 1;
      --hlb-index-width: 1.5;
      --hlb-watershed-width: 20;
      --hlb-stream-width: 1.6;
    }
    .hlb-bg        { fill: var(--hlb-bg); }
    .hlb-contours       { fill: none; stroke: var(--hlb-contour);
                          stroke-width: var(--hlb-contour-width);
                          opacity: var(--hlb-contour-opacity);
                          stroke-linejoin: round; stroke-linecap: round; }
    .hlb-contours-index { fill: none; stroke: var(--hlb-contour);
                          stroke-width: var(--hlb-index-width);
                          opacity: var(--hlb-index-opacity);
                          stroke-linejoin: round; stroke-linecap: round; }
    .hlb-watersheds     { fill: none; stroke: var(--hlb-watershed);
                          stroke-width: var(--hlb-watershed-width);
                          stroke-dasharray: calc(var(--hlb-watershed-width) * 1.9)
                                            calc(var(--hlb-watershed-width) * 1.25);
                          opacity: var(--hlb-watershed-opacity);
                          stroke-linejoin: round; stroke-linecap: butt; }
    .hlb-streams        { fill: none; stroke: var(--hlb-water);
                          stroke-width: var(--hlb-stream-width);
                          opacity: var(--hlb-stream-opacity);
                          stroke-linejoin: round; stroke-linecap: round; }
    .hlb-streams-intermittent { stroke-dasharray: 5 4; }
    .hlb-canals         { fill: none; stroke: var(--hlb-water);
                          stroke-width: calc(var(--hlb-stream-width) * .8);
                          stroke-dasharray: 1 5; stroke-linecap: round;
                          opacity: var(--hlb-stream-opacity); }
    .hlb-waterbodies    { fill: var(--hlb-water);
                          fill-opacity: var(--hlb-waterbody-fill-opacity);
                          stroke: var(--hlb-water); stroke-width: 2;
                          stroke-opacity: 1; stroke-linejoin: round;
                          paint-order: stroke fill; }
    .hlb-waterbodies-marsh { fill: var(--hlb-water); fill-opacity: .12;
                             stroke: var(--hlb-water); stroke-width: 1;
                             stroke-dasharray: 2 3; stroke-opacity: .5; }
  </style>"""


def write_background(frame: Frame, lb: LayerBundle, meta: dict) -> Path:
    def group(cls: str, paths: list[str]) -> str:
        return f'<g class="{cls}">{"".join(paths)}</g>' if paths else ""

    body = [
        BACKGROUND_STYLE,
        f'<rect class="hlb-bg" width="{frame.width}" height="{frame.height}"/>',
        group("hlb-contours", lb.contours_inter),
        group("hlb-contours-index", lb.contours_index),
        group("hlb-canals", lb.canals),
        group("hlb-streams hlb-streams-intermittent", lb.streams_intermittent),
        group("hlb-streams", lb.streams),
        group("hlb-waterbodies-marsh", lb.waterbodies_marsh),
        group("hlb-waterbodies", lb.waterbodies),
        group("hlb-watersheds", lb.watersheds),   # bold dashed HUC lines on top
    ]
    comment = ("<!-- generated by hydro_login_bg.py  "
               f"center={meta['lat']},{meta['lon']} zoom={meta['zoom']} "
               f"bbox={meta['bbox']} -->")
    svg = _svg_open(frame, 'class="hlb-root"') + comment + "".join(body) + "</svg>"
    p = OUT / "background.svg"
    p.write_text(svg)
    return p


# --------------------------------------------------------------------------- #
# Login preview page
# --------------------------------------------------------------------------- #
def write_preview(frame: Frame, background_svg: str, meta: dict) -> Path:
    # strip the outer <svg ...> wrapper's xmlns dupes are fine; embed as-is.
    html = PREVIEW_HTML.replace("__BG_SVG__", background_svg).replace(
        "__META__", json.dumps(meta))
    p = OUT / "preview.html"
    p.write_text(html)
    return p


PREVIEW_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HydroServer login background - preview</title>
<style>
  :root {
    --hlb-bg: #eef4f7;
    --hlb-ink: #93a9b8;
    --hlb-water: #3f7fae;
    --page-ground: #f5f8fa;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont,
       "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background: var(--page-ground); color: #1f2933; }
  .stage { position: fixed; inset: 0; overflow: hidden; }
  .stage .hlb-root { position: absolute; inset: 0; width: 100%; height: 100%; }
  .card {
    position: relative; z-index: 2; width: min(440px, calc(100vw - 40px));
    margin: 7vh auto 0; background: #fff; border-radius: 18px; padding: 40px 40px 32px;
    box-shadow: 0 20px 60px -20px rgba(20,50,80,.35), 0 4px 12px rgba(20,50,80,.08);
  }
  .card h1 { text-align: center; font-size: 26px; margin: 8px 0 26px; }
  .logo { display:block; margin: 0 auto 4px; width: 52px; height: 52px; }
  label { display:block; font-size: 12px; color:#6b7a86; margin: 14px 0 4px; }
  input, select { width:100%; padding:12px 14px; border:1px solid #d7dee3;
      border-radius:10px; font-size:14px; background:#fff; }
  .btn { margin-top: 22px; float:right; background: var(--hlb-water); color:#fff;
      border:0; padding:11px 22px; border-radius:10px; font-weight:600; cursor:pointer; }
  .back { position: relative; z-index: 2; display:block; text-align:center;
      margin-top: 3vh; color:#5a6b76; font-size:14px; text-decoration:none; }

  .panel {
    position: fixed; top: 14px; right: 14px; z-index: 10; width: 250px;
    background: rgba(255,255,255,.94); backdrop-filter: blur(6px);
    border: 1px solid #dde5ea; border-radius: 12px; padding: 12px 14px;
    box-shadow: 0 8px 30px rgba(20,50,80,.18); font-size: 12px;
  }
  .panel h2 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase;
      letter-spacing: .06em; color:#6b7a86; }
  .row { display:flex; align-items:center; justify-content:space-between; margin: 6px 0; gap: 8px; }
  .row input[type=color] { width: 40px; height: 24px; padding: 0; border-radius: 6px; }
  .row input[type=range] { width: 130px; }
  .panel .presets { display:flex; flex-wrap:wrap; gap:6px; margin-top: 10px; }
  .panel .presets button { flex:1 0 auto; padding:6px 8px; border:1px solid #cfd9df;
      background:#fff; border-radius:8px; cursor:pointer; font-size:11px; }
  .meta { margin-top: 10px; color:#8a97a1; font-size: 10px; line-height: 1.4; }
</style>
</head>
<body>
  <div class="stage">__BG_SVG__</div>

  <div class="panel">
    <h2>Theme</h2>
    <div class="row"><span>Background</span><input type="color" id="c-bg" value="#eef4f7"></div>
    <div class="row"><span>Lines (ink)</span><input type="color" id="c-ink" value="#93a9b8"></div>
    <div class="row"><span>Water</span><input type="color" id="c-water" value="#3f7fae"></div>
    <div class="row"><span>Contour opacity</span><input type="range" id="r-cont" min="0" max="1" step="0.02" value="0.34"></div>
    <div class="row"><span>Contour width</span><input type="range" id="r-cw" min="0.3" max="3" step="0.1" value="1"></div>
    <div class="row"><span>Watershed opacity</span><input type="range" id="r-ws" min="0" max="1" step="0.02" value="0.5"></div>
    <div class="row"><span>Watershed width</span><input type="range" id="r-wsw" min="0" max="48" step="1" value="20"></div>
    <div class="row"><span>Water opacity</span><input type="range" id="r-wat" min="0" max="1" step="0.02" value="0.9"></div>
    <div class="presets">
      <button data-t="paper">Paper</button>
      <button data-t="blueprint">Blueprint</button>
      <button data-t="night">Night</button>
      <button data-t="sage">Sage</button>
    </div>
    <div class="meta" id="meta"></div>
  </div>

  <a class="back" href="#">&larr; Back to website</a>
  <form class="card" onsubmit="return false">
    <svg class="logo" viewBox="0 0 48 48" fill="none" stroke="var(--hlb-water)" stroke-width="2.5" stroke-linecap="round">
      <circle cx="16" cy="12" r="3"/><circle cx="30" cy="9" r="3"/><circle cx="24" cy="22" r="3"/>
      <path d="M18 13l4 7M27 11l-2 8"/>
      <path d="M6 33c4 0 4 4 8 4s4-4 8-4 4 4 8 4 4-4 8-4" stroke-width="2"/>
      <path d="M6 40c4 0 4 4 8 4s4-4 8-4 4 4 8 4 4-4 8-4" stroke-width="2"/>
    </svg>
    <h1>Sign up</h1>
    <label>Email *</label><input type="email">
    <label>First name</label><input type="text">
    <label>Last name</label><input type="text">
    <label>Account type *</label><select><option>Select an account type...</option></select>
    <label>Password *</label><input type="password">
    <label>Password (again) *</label><input type="password">
    <button class="btn">Sign up</button>
  </form>

<script>
const root = document.querySelector('.hlb-root');
const S = (k, v) => root.style.setProperty(k, v);
const meta = __META__;
document.getElementById('meta').textContent =
  `${meta.preset || 'custom'} - ${meta.lat}, ${meta.lon} - zoom ${meta.zoom}
water:${meta.counts.waterbodies}+${meta.counts.flowlines}  contours:${meta.counts.contours}  huc:${meta.counts.watersheds}`;

const bind = (id, fn) => document.getElementById(id).addEventListener('input', e => fn(e.target.value));
bind('c-bg',  v => { S('--hlb-bg', v); document.body.style.setProperty('--page-ground', v); });
bind('c-ink', v => S('--hlb-ink', v));
bind('c-water', v => { S('--hlb-water', v); document.documentElement.style.setProperty('--hlb-water', v); });
bind('r-cont', v => S('--hlb-contour-opacity', v));
bind('r-cw',  v => { S('--hlb-contour-width', v); S('--hlb-index-width', v * 1.5); });
bind('r-ws',  v => S('--hlb-watershed-opacity', v));
bind('r-wsw', v => S('--hlb-watershed-width', v));
bind('r-wat', v => S('--hlb-stream-opacity', v));

const THEMES = {
  paper:     { '--hlb-bg':'#f2ede2', '--hlb-ink':'#b8a888', '--hlb-water':'#5f8fb0' },
  blueprint: { '--hlb-bg':'#0f2f52', '--hlb-ink':'#5f9fd6', '--hlb-water':'#a7d3f2' },
  night:     { '--hlb-bg':'#0d1b2a', '--hlb-ink':'#39506a', '--hlb-water':'#4b9fd6' },
  sage:      { '--hlb-bg':'#eef1ec', '--hlb-ink':'#9fb39a', '--hlb-water':'#4f8a6b' },
};
document.querySelectorAll('.presets button').forEach(b =>
  b.addEventListener('click', () => {
    const t = THEMES[b.dataset.t];
    for (const k in t) S(k, t[k]);
    document.body.style.setProperty('--page-ground', t['--hlb-bg']);
    document.documentElement.style.setProperty('--hlb-water', t['--hlb-water']);
  }));
</script>
</body>
</html>
"""


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def _exterior_rings_lonlat(feat: dict) -> list[list[list[float]]]:
    geom = feat.get("geometry") or {}
    t, c = geom.get("type"), geom.get("coordinates")
    if t == "Polygon":
        return [c[0]] if c else []
    if t == "MultiPolygon":
        return [poly[0] for poly in c if poly]
    return []


def _shoelace(ring: list[list[float]]) -> tuple[float, float, float]:
    """Return (abs_area, cx, cy) for a lon/lat ring (planar approximation)."""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        cr = x0 * y1 - x1 * y0
        a += cr
        cx += (x0 + x1) * cr
        cy += (y0 + y1) * cr
    a *= 0.5
    if abs(a) < 1e-12:
        xs = [p[0] for p in ring] or [0]
        ys = [p[1] for p in ring] or [0]
        return 0.0, sum(xs) / len(xs), sum(ys) / len(ys)
    return abs(a), cx / (6 * a), cy / (6 * a)


def frame_on_water(lat: float, lon: float, zoom: int, width: int, height: int,
                   fit_frac: float, refresh: bool) -> Frame:
    """Re-center (and, if fit_frac, re-zoom) so the lake near (lat, lon) is framed.

    Probes at the *requested* zoom (never wider, so we don't drag in a distant
    reservoir) and scores each waterbody by area attenuated by distance from the
    requested center -- big AND nearby wins.
    """
    probe = Frame(lat, lon, zoom, width, height)
    fc = arcgis_query(NHD, NHD_WATERBODY, probe, tag="wb_probe",
                      out_fields="fcode,gnis_name", refresh=refresh)
    parts = []  # (area, cx, cy, ring, name)
    for feat in fc["features"]:
        for ring in _exterior_rings_lonlat(feat):
            if len(ring) >= 4:
                parts.append((*_shoelace(ring), ring,
                              feat.get("properties", {}).get("gnis_name")))
    if not parts:
        print("  frame-on-water: no waterbody found; keeping center")
        return Frame(lat, lon, zoom, width, height)

    def score(p):
        _area, cx, cy, *_ = p
        return _area / (1.0 + (math.hypot(cx - lon, cy - lat) / 0.04) ** 2)

    best = max(parts, key=score)
    _, ax, ay, _, name = best
    pts: list[list[float]] = []
    for _area, cx, cy, ring, _n in parts:
        if math.hypot(cx - ax, cy - ay) <= 0.035:   # same lake, split into parts
            pts.extend(ring)
    west, east = min(p[0] for p in pts), max(p[0] for p in pts)
    south, north = min(p[1] for p in pts), max(p[1] for p in pts)
    c_lon, c_lat = (west + east) / 2, (south + north) / 2

    new_zoom = zoom
    if fit_frac:
        # frame spans  width * 360 / (256 * 2**z)  degrees; want lake = fit_frac of that
        span_deg = max(east - west, (north - south) * width / height, 1e-4)
        ratio = fit_frac * width * 360.0 / (256.0 * span_deg)
        new_zoom = max(9, min(15, int(round(math.log2(max(ratio, 1.0))))))
    print(f"  frame-on-water: {c_lat:.4f},{c_lon:.4f} zoom={new_zoom}"
          f"  ({name or 'unnamed water body'})")
    return Frame(c_lat, c_lon, new_zoom, width, height)


def run(args: argparse.Namespace) -> None:
    global OUT
    if args.out:
        OUT = Path(args.out) if os.path.isabs(args.out) else HERE / args.out
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.preset:
        plat, plon, pzoom = PRESETS[args.preset]
        lat = args.lat if args.lat is not None else plat
        lon = args.lon if args.lon is not None else plon
        zoom = args.zoom if args.zoom is not None else pzoom
    else:
        if args.lat is None or args.lon is None:
            sys.exit("Provide --preset, or both --lat and --lon.")
        lat, lon, zoom = args.lat, args.lon, args.zoom or 12

    if args.fit or args.auto_center:
        frame = frame_on_water(lat, lon, zoom, args.width, args.height,
                               args.fit, args.refresh)
        zoom = frame.zoom
    else:
        frame = Frame(lat, lon, zoom, args.width, args.height)

    if args.shift_x or args.shift_y:
        # slide the map so the subject sits off-center (e.g. clear of the card).
        # +shift_x moves content right (view center moves left).
        cx = frame.world_x0 + (0.5 - args.shift_x) * frame.width * frame.scale
        cy = frame.world_y0 + (0.5 - args.shift_y) * frame.height * frame.scale
        nlon, nlat = world_to_lonlat(cx, cy)
        frame = Frame(nlat, nlon, zoom, args.width, args.height)

    print(f"Frame  center=({frame.lat:.4f},{frame.lon:.4f}) zoom={zoom} "
          f"{args.width}x{args.height}\n  bbox={frame.bbox}")

    simplify = args.simplify

    # ---- fetch --------------------------------------------------------------
    print("Fetching NHD waterbodies / areas / flowlines ...")
    wb = arcgis_query(NHD, NHD_WATERBODY, frame, tag="waterbody",
                      out_fields="fcode,gnis_name,areasqkm", refresh=args.refresh)
    ar = arcgis_query(NHD, NHD_AREA, frame, tag="nhdarea",
                      out_fields="fcode", refresh=args.refresh)
    fl = arcgis_query(NHD, NHD_FLOWLINE, frame, tag="flowline",
                      out_fields="fcode,gnis_name,lengthkm", refresh=args.refresh)

    print("Fetching USGS contours (index + intermediate) ...")
    ci = arcgis_query(CONTOURS, CONTOUR_INDEX, frame, tag="contour_index",
                      out_fields="contourelevation", refresh=args.refresh)
    cn = arcgis_query(CONTOURS, CONTOUR_INTER, frame, tag="contour_inter",
                      out_fields="contourelevation", refresh=args.refresh)

    frame_deg = frame.deg_per_px * frame.width
    huc = args.huc or (8 if frame_deg > 1.4 else 10 if frame_deg > 0.55 else 12)
    print(f"Fetching WBD watershed boundaries (HUC-{huc}) ...")
    huc_layer = {8: 4, 10: 5, 12: 6, 14: 7}[huc]
    ws = arcgis_query(WBD, huc_layer, frame, tag=f"wbd_hu{huc}",
                      out_fields="name", refresh=args.refresh)

    if args.dump_raw:
        for name, fc in [("01_water", {"type": "FeatureCollection", "features":
                                       wb["features"] + ar["features"] + fl["features"]}),
                         ("02_contours", {"type": "FeatureCollection", "features":
                                          ci["features"] + cn["features"]}),
                         ("03_watersheds", ws)]:
            (OUT / f"{name}.geojson").write_text(json.dumps(fc))

    # ---- build layers -----------------------------------------------------
    print("Projecting + simplifying ...")
    lb = LayerBundle()
    lb.contours_index, lb.contours_inter = build_contours(
        frame, ci, cn, args.contour_step, simplify, args.min_feature_px)
    lb.watersheds = build_watersheds(frame, ws, simplify * 1.5)
    lb.streams, lb.streams_intermittent, lb.canals = build_flowlines(
        frame, fl, simplify, args.min_stream_px)
    lb.waterbodies, lb.waterbodies_marsh = build_waterbodies(
        frame, wb, ar, simplify=simplify, min_px=args.min_stream_px)

    lb.counts = dict(
        waterbodies=len(lb.waterbodies) + len(lb.waterbodies_marsh),
        flowlines=len(lb.streams) + len(lb.streams_intermittent) + len(lb.canals),
        contours=len(lb.contours_index) + len(lb.contours_inter),
        watersheds=len(lb.watersheds),
    )
    print("  ", lb.counts)

    # ---- per-stage previews --------------------------------------------------
    write_layer_preview("water", frame, [
        ("waterbodies", 'fill="#2f6f9e" fill-opacity="0.85" stroke="#8ecae6" stroke-width="1.5"', lb.waterbodies),
        ("marsh", 'fill="#2f6f9e" fill-opacity="0.3" stroke="#8ecae6" stroke-width="1" stroke-dasharray="2 3"', lb.waterbodies_marsh),
        ("streams", 'fill="none" stroke="#61a5c2" stroke-width="1.5"', lb.streams),
        ("intermittent", 'fill="none" stroke="#61a5c2" stroke-width="1.2" stroke-dasharray="5 4"', lb.streams_intermittent),
        ("canals", 'fill="none" stroke="#89c2d9" stroke-width="1" stroke-dasharray="1 4"', lb.canals),
    ])
    write_layer_preview("contours", frame, [
        ("inter", 'fill="none" stroke="#7f8fa0" stroke-width="0.8" opacity="0.7"', lb.contours_inter),
        ("index", 'fill="none" stroke="#c9d6e0" stroke-width="1.4"', lb.contours_index),
    ])
    write_layer_preview("watersheds", frame, [
        ("huc", 'fill="none" stroke="#e0a458" stroke-width="20" stroke-dasharray="38 25" opacity="0.85"', lb.watersheds),
    ])

    meta = dict(preset=args.preset, lat=round(frame.lat, 5), lon=round(frame.lon, 5),
                zoom=zoom, width=args.width, height=args.height, bbox=frame.bbox,
                argv=" ".join(sys.argv[1:]),
                fit=args.fit, shift=[args.shift_x, args.shift_y],
                huc=huc, contour_step=args.contour_step,
                simplify=args.simplify, min_feature_px=args.min_feature_px,
                counts=lb.counts,
                sources=dict(water=NHD, contours=CONTOURS, watersheds=WBD))
    (OUT / "manifest.json").write_text(json.dumps(meta, indent=2))

    bg = write_background(frame, lb, meta)
    write_preview(frame, bg.read_text(), meta)

    kb = bg.stat().st_size / 1024
    print(f"\nWrote:")
    for f in sorted(OUT.glob("*")):
        if f.is_file():
            print(f"  {f.relative_to(HERE)}  ({f.stat().st_size/1024:.0f} KB)")
    print(f"\nOpen  {(OUT / 'preview.html').relative_to(HERE)}  to iterate on colors.")
    if kb > 900:
        print(f"NOTE: background.svg is {kb:.0f} KB - raise --simplify or --contour-step.")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--preset", choices=sorted(PRESETS), help="named location")
    p.add_argument("--lat", type=float, help="center latitude (overrides preset)")
    p.add_argument("--lon", type=float, help="center longitude (overrides preset)")
    p.add_argument("--zoom", type=int, help="slippy-map zoom (10-14 typical)")
    p.add_argument("--width", type=int, default=1600, help="output px width (viewBox)")
    p.add_argument("--height", type=int, default=1000, help="output px height (viewBox)")
    p.add_argument("--out", type=str, default="", metavar="DIR",
                   help="output dir (relative to script, default 'out'); "
                        "cache is always shared in out/cache")
    p.add_argument("--auto-center", action="store_true",
                   help="re-center on the dominant waterbody (no re-zoom)")
    p.add_argument("--fit", type=float, default=0.0, metavar="FRAC",
                   help="re-center AND re-zoom so the lake fills ~FRAC of the "
                        "frame width, e.g. --fit 0.55")
    p.add_argument("--shift-x", type=float, default=0.0, metavar="FRAC",
                   help="slide subject off-center horizontally, e.g. 0.18 = right")
    p.add_argument("--shift-y", type=float, default=0.0, metavar="FRAC",
                   help="slide subject off-center vertically, e.g. -0.1 = up")
    p.add_argument("--huc", type=int, default=None, choices=[8, 10, 12, 14],
                   help="watershed level for the dashed lines (8=big basins .. 14=tiny). "
                        "Default: auto by frame size (wide frame -> coarser).")
    p.add_argument("--contour-step", type=int, default=3,
                   help="keep every Nth 40-ft intermediate contour (3 = every 120 ft)")
    p.add_argument("--simplify", type=float, default=1.1,
                   help="Douglas-Peucker tolerance in px (higher = smaller file)")
    p.add_argument("--min-feature-px", type=float, default=26.0,
                   help="drop contour fragments shorter than this (px)")
    p.add_argument("--min-stream-px", type=float, default=7.0,
                   help="drop unnamed stream fragments / ponds smaller than this "
                        "(px); raise it for metro areas, e.g. 18")
    p.add_argument("--refresh", action="store_true", help="ignore cache, refetch")
    p.add_argument("--dump-raw", action="store_true",
                   help="also write 01_water / 02_contours / 03_watersheds .geojson "
                        "(raw features, several MB)")
    return p


if __name__ == "__main__":
    run(build_parser().parse_args())
