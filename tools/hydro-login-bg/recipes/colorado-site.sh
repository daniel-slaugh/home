#!/bin/bash
# Colorado River near Moab — HydroServer login background with a monitoring-site pin.
#
# Composition: river hugs the left ~30% of the frame, center left open for the
# login form, faded map (overlay 0.2), monitoring pin snapped to the river at
# ~x0.22 (clear of a centered form). No text label.
#
# Re-run from the tool directory:  bash recipes/colorado-site.sh
# Tweak and re-run — geometry is cached, so edits to shift/opacity/marker are instant.

cd "$(dirname "$0")/.." || exit 1

COMMON=(
  --lat 38.5900 --lon -109.5700 --zoom 12
  --shift-x -0.30              # river toward the left edge  (less negative = right)
  --label "Colorado River"     # names the feature so --marker aims at the river
  --no-label                   # ...but don't draw the text
  --marker                     # HydroServer-style monitoring-site pin
  --marker-at 0.22             # aim it at x=0.22 of the frame, then snap to the river
                               #   (add ,Y e.g. 0.22,0.55 to pin the height too)
  --overlay-opacity 0.2        # fade every drawn layer to 20%; background stays solid
  --contour-step 4 --min-feature-px 35 --min-stream-px 18 --simplify 1.3
)

# subtle marker (fades with the map — the picked variant)
python3 generate_geo_map.py "${COMMON[@]}" --out out/colorado-marker

# crisp marker (full opacity over the faded map)
python3 generate_geo_map.py "${COMMON[@]}" --marker-crisp --out out/colorado-marker-crisp

echo
echo "wrote out/colorado-marker/background.svg  (subtle pin)"
echo "wrote out/colorado-marker-crisp/background.svg  (crisp pin)"
