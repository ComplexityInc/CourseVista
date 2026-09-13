Assets for the public demonstration page (/demo).

The page layout is /demo/demo.js; what it shows is set in /demo/configs/public.js.
To add, remove or relabel a film or source image, edit that config — not the HTML.

Per case study:
  case-0N.mp4           the film
  case-0N-poster.jpg    poster frame (resting artwork before play / on pause / after the end)
  case-0N-src-N.jpg     source photographs shown under "What this was built from"
  case-0N-map.jpg       hole map

A video listed in the config but missing from this folder is skipped
automatically, so it never appears as a broken player.

Client demos (e.g. /demo/mt-osmond) keep their own files in /demo/<slug>/assets/.
Never reuse one client's footage or logo on another client's page.
