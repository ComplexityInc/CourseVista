Drop the demo assets in this folder using exactly these names.

Per case study (01-04):
  case-0N.mp4           the film
  case-0N-poster.jpg    poster frame
  case-0N-src-1.jpg     source photograph 1
  case-0N-src-2.jpg     source photograph 2
  case-0N-src-3.jpg     source photograph 3   (omit for case 03)
  case-0N-src-4.jpg     source photograph 4   (omit for case 03)
  case-0N-map.jpg       hole map

Case study 03 is wired for 2 photographs + 1 map, per the spec.
If a source image is missing the thumbnail will show as a broken
image, so remove that <figure> block from index.html rather than
leaving it pointing at a file that does not exist.
