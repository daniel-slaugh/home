# hydro-login-bg

Generate a themeable **SVG map background** for the HydroServer login / signup
page from real public USGS data — contours, hydrography, and watershed
boundaries — reprojected into one tidy set of SVG line layers.

```
python3 hydro_login_bg.py --preset deer-creek --fit 0.5
open out/preview.html
```

Needs Python 3.10+, `requests`, `numpy` (`pip install requests numpy`).

## Pipeline

| # | Layer | Source (public ArcGIS REST, no key) |
|---|-------|-------------------------------------|
| 1 | **Bounding box** | center `lat,lon` + slippy `zoom` + pixel size → Web-Mercator bbox (same math a map tile uses) |
| 2 | **Water** — lakes, reservoirs, rivers, streams, canals | USGS **NHD** (National Hydrography Dataset) `nhd/MapServer` layers 12 / 9 / 6 |
| 3 | **Terrain** — index + intermediate contour lines | USGS **contours** `contours/MapServer` layers 25 / 26 (The National Map) |
| 4 | **Watersheds** — fat dashed HUC boundary lines, drawn *on top* | USGS **WBD** (Watershed Boundary Dataset) `wbd/MapServer`, HUC-8/10/12/14 |
| 5 | **Compose** | project → simplify (Douglas–Peucker) → grouped SVG `<path>` layers with CSS-variable theming |

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
  --hlb-ink: #39506a;    /* every contour + watershed line */
  --hlb-water: #4b9fd6;  /* lakes + rivers            */
}
```

Finer knobs (all optional, sensible defaults baked in):
`--hlb-contour`, `--hlb-watershed`, `--hlb-contour-opacity`, `--hlb-index-opacity`,
`--hlb-watershed-opacity`, `--hlb-stream-opacity`, `--hlb-waterbody-fill-opacity`,
`--hlb-contour-width`, `--hlb-index-width`, `--hlb-watershed-width` (default **20** —
the watershed dashes are meant to read as a bold top layer), `--hlb-stream-width`.
The watershed dash gaps scale with `--hlb-watershed-width`, so one knob resizes them.

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
--huc 8|10|12|14            watershed level for the dashed lines. Default: auto by
                            frame size (wide frame → coarser, so it stays legible)
--contour-step 3            keep every Nth 40-ft contour (3 = 120-ft interval; 1 = dense)
--simplify 1.1              Douglas–Peucker px tolerance (higher = smaller file)
--min-feature-px 26         drop contour crumbs shorter than this
--min-stream-px 7           drop unnamed stream fragments / ponds smaller than this;
                            raise to ~20 for metro areas (named rivers always kept)
--dump-raw                  also write the raw *.geojson feature dumps
--refresh                   ignore the cache and refetch
```

Samples in this folder were built with:

```
# out/  (hero)
python3 hydro_login_bg.py --preset deer-creek --fit 0.55 --shift-y -0.18 --dump-raw
# out-jordanelle/
python3 hydro_login_bg.py --preset jordanelle --fit 0.5 --out out-jordanelle
# out-great-salt-lake/  — huge, urbanized shoreline: needs the declutter knobs
python3 hydro_login_bg.py --preset great-salt-lake --out out-great-salt-lake \
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
  --hlb-bg: #eef4f7;
  --hlb-ink: #93a9b8;
  --hlb-water: #3f7fae;
}
@media (prefers-color-scheme: dark) {
  .hydro-bg .hlb-root { --hlb-bg:#0d1b2a; --hlb-ink:#39506a; --hlb-water:#4b9fd6; }
}
```

Copy `out/background.svg` to `templates/accounts/_background.svg`. Don't use
`<img src>` — outside CSS can't reach into it, so the variables won't apply.
