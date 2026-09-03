# hydro-login-bg

Generate a themeable **SVG map background** for the HydroServer login / signup
page from real public USGS data — contours, hydrography, and watershed
boundaries — reprojected into one tidy set of SVG line layers.

```
python3 generate_geo_map.py --preset deer-creek --fit 0.5
open out/preview.html
```

Needs Python 3.10+, `requests`, `numpy` (`pip install requests numpy`).

## Pipeline

| # | Layer | Source (public ArcGIS REST, no key) |
|---|-------|-------------------------------------|
| 1 | **Bounding box** | center `lat,lon` + slippy `zoom` + pixel size → Web-Mercator bbox (same math a map tile uses) |
| 2 | **Water** — lakes, reservoirs, rivers, streams, canals | USGS **NHD** (National Hydrography Dataset) `nhd/MapServer` layers 12 / 9 / 6 |
| 3 | **Terrain** — index + intermediate contour lines | USGS **contours** `contours/MapServer` layers 25 / 26 (The National Map) |
| 4 | **Watersheds** — HUC borders **dissolved to one line where basins share an edge**, then traced with short, **evenly-spaced round-capped marks** ("macaronis"), drawn *on top* | USGS **WBD** (Watershed Boundary Dataset) `wbd/MapServer`, HUC-8/10/12/14 |
| 5 | **Compose** | project → simplify (Douglas–Peucker) → grouped SVG `<path>` layers with CSS-variable theming, plus a **feature-of-interest label** over the dominant waterbody / river |

The server generalizes geometry to ~1 screen pixel (`maxAllowableOffset`) before
sending, so even a frame that spans the whole Great Salt Lake stays a few MB
rather than 100+.

## Outputs (`out/`)

| file | what |
|------|------|
| `layer_water.svg`, `layer_contours.svg`, `layer_watersheds.svg` | each pipeline stage on its own, plain styling, for eyeballing |
| **`background.svg`** | the deliverable — all layers, themeable |
| `preview.html` | the login card mock over the background + live color controls |
| `manifest.json` | frame + params (`argv` reproduces the run) + feature counts |
| `01_water.geojson` … | raw fetched features (WGS84) — only with `--dump-raw`; several MB; gitignored |
| `cache/` | raw API responses, keyed by request — re-runs are instant/offline. `--refresh` to bust. gitignored |

## Theming `background.svg`

**Inline** the SVG into your markup (Astro/Vue `set:html` / `v-html`) — an
`<img src>` can't see outside CSS variables. Then:

```css
.hlb-root {
  --hlb-bg: #0d1b2a;     /* background fill            */
  --hlb-ink: #39506a;    /* every contour + basin line */
  --hlb-water: #4b9fd6;  /* lakes + rivers            */
  --hlb-label: #8fc7ea;  /* feature-of-interest label */
}
```

The label is set in **Archivo** — the host page must load that font (the
signup page already does); it falls back to Helvetica/Arial otherwise.

Finer knobs (all optional, sensible defaults baked in):
`--hlb-contour`, `--hlb-watershed`, `--hlb-contour-opacity`, `--hlb-index-opacity`,
`--hlb-watershed-opacity`, `--hlb-stream-opacity`, `--hlb-waterbody-fill-opacity`,
`--hlb-contour-width`, `--hlb-index-width`, `--hlb-watershed-width` (default
**3.2** — width of each basin mark; round caps make them little capsules;
`--hlb-watershed-opacity` defaults to **1** so the basin layer reads clearly),
`--hlb-stream-width`, `--hlb-label-size` (default **17**), `--hlb-overlay-opacity`
(default **1** — drop it to e.g. `.8` to fade every drawn layer at once while the
background fill stays solid).

The basin mark length + spacing are baked at generation time — pass
`--basin-dash` / `--basin-gap` (px).

`preserveAspectRatio="xMidYMid slice"` — it fills any container, cropping the
overflow, like a CSS `background-size: cover`.

## Common flags

```
--preset {deer-creek,jordanelle,pineview,bear-lake,yellowstone,tahoe,
          crater-lake,powell,great-salt-lake}
--lat --lon --zoom          explicit framing (zoom ~10–14)
--fit 0.5                   auto re-center + re-zoom so the lake fills ~50% of the width
--auto-center               re-center on the lake but keep the given zoom
--shift-x -0.18             slide the subject off-center (fraction of frame); +x = right
--shift-y -0.1              +y = down
--width 1600 --height 1000  output viewBox size
--out out-tahoe             write to a different dir (cache stays shared in out/cache)
--huc 8|10|12|14            watershed level for the basin marks. Default: auto by
                            frame size (wide frame → coarser, so it stays legible)
--basin-dash 9             length of each little curved basin-boundary mark (px)
--basin-gap 10             gap between basin-boundary marks along the line (px)
--label "Deer Creek Reservoir"   override the feature-of-interest label text
--no-label                  don't draw the feature-of-interest label
--overlay-opacity 0.8       fade every drawn layer at once (bg stays solid);
                            0.8 = 20% more transparent, for a subtler variant
--marker                    drop a HydroServer-style monitoring-site pin on the
                            subject, snapped to the nearest matching flowline
                            (combine with --label NAME --no-label to aim it
                            without drawing the text)
--marker-crisp              keep that pin full-opacity even when --overlay-opacity
                            fades the rest of the map
--marker-at 0.22            aim the pin at this fraction of the frame width (Y
                            optional: 0.22,0.4) before snapping to the river —
                            use it to keep the pin clear of a centered login form
--contour-step 3            keep every Nth 40-ft contour (3 = 120-ft interval; 1 = dense)
--simplify 1.1              Douglas–Peucker px tolerance (higher = smaller file)
--min-feature-px 26         drop contour crumbs shorter than this
--min-stream-px 7           drop unnamed stream fragments / ponds smaller than this;
                            raise to ~20 for metro areas (named rivers always kept)
--dump-raw                  also write the raw *.geojson feature dumps
--refresh                   ignore the cache and refetch
```

Saved recipes live in `recipes/` — a runnable, commented script per composition
you want to be able to pick up and tweak later (e.g. `recipes/colorado-site.sh`).

Samples in this folder were built with:

```
# out/  (hero) — Deer Creek Reservoir framed into the left third, clear of the card
python3 generate_geo_map.py --lat 40.415 --lon -111.440 --zoom 13 --dump-raw
# out-jordanelle/
python3 generate_geo_map.py --lat 40.611 --lon -111.429 --zoom 13 --out out-jordanelle
# out-great-salt-lake/  — huge, urbanized shoreline: needs the declutter knobs
python3 generate_geo_map.py --preset great-salt-lake --out out-great-salt-lake \
    --contour-step 5 --min-feature-px 40 --min-stream-px 24 --simplify 1.5
```

Tune for file size: raise `--contour-step`, `--simplify`, `--min-feature-px`,
`--min-stream-px`. `background.svg` for the default preset is ~480 KB (~120 KB
gzipped); a lake-spanning frame like Great Salt Lake lands near 900 KB.

## Using it in HydroServer

The signup page is a Django template, so inline the SVG:

```django
{# accounts/signup.html #}
<div class="hydro-bg">{% include "accounts/_background.svg" %}</div>
```

```css
.hydro-bg { position: fixed; inset: 0; z-index: -1; }
.hydro-bg .hlb-root { width: 100%; height: 100%; }
.hydro-bg .hlb-root {
  --hlb-bg: #f2f6f8;
  --hlb-ink: #a6bac6;
  --hlb-water: #6ba4c4;
  --hlb-label: #2f6d97;
}
@media (prefers-color-scheme: dark) {
  .hydro-bg .hlb-root {
    --hlb-bg:#0e1c2b; --hlb-ink:#33475d; --hlb-water:#4b9fd6; --hlb-label:#8fc7ea;
  }
}
```

The subject sits in the **left third** of the frame, so keep the signup card
to the right (`margin-left: auto` / right-aligned column) to leave the labelled
water visible behind the page.

Copy `out/background.svg` to `templates/accounts/_background.svg`. Don't use
`<img src>` — outside CSS can't reach into it, so the variables won't apply.
