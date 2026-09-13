Mount Osmond Golf Club — demo assets (/demo/mt-osmond)

Put these files directly in this folder. Names are CASE-SENSITIVE on the live
site (Vercel), so keep them exactly as written. Only Mount Osmond material here.

LOGO (resting artwork on every video)
  mtosmond-logo.png            Original colours/proportions. Shown uncropped on white,
                               never enlarged past 2x its own size — the larger the
                               source file, the crisper it looks (1000px+ is ideal).

VIDEOS (hole matched frame-by-frame to the original renders)
  MtOsmondDemo-1.mp4           Hole 1
  MtOsmondDemo-2.mp4           Hole 3
  MtOsmondDemo-3.mp4           Hole 16

  The copies here have been remuxed with "faststart" (index moved to the front of
  the file, no re-encode) so they begin playing before fully downloading. If you
  replace a video, run the same step on the new file:
    ffmpeg -i in.mp4 -map 0 -c copy -movflags +faststart MtOsmondDemo-N.mp4

HOLE 1 — photos + map
  mtosmond-Hole1Img.png
  mtosmond-Hole1Img2.png
  mtosmond-hole1Img3.png
  mtosmond-Hole1Img4.png
  mtosmond-hole1map.jpg

HOLE 3 — photos + map
  mtosmond-hole3img1.png
  mtosmond-hole3img2.png
  mtosmond-hole3img3.png
  mtosmond-hole3img4.png
  mtosmond-hole3map.jpg

HOLE 16 — photos + map
  mtosmond-hole16img1.png
  mtosmond-hole16img2.png
  mtosmond-hole16img3.png
  mtosmond-hole16img4.png
  mtosmond-hole16map.jpg

Anything listed but not uploaded is simply left out of the page (no broken
players or thumbnails). To change names or add a hole, edit
/demo/configs/mt-osmond.js.

Still to set in that config: course.holes (verified full-course hole count from
the project record) and, optionally, handoff.website / handoff.city.
