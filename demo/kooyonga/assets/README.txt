Kooyonga Golf Club — demo assets (/demo/kooyonga)

Put these files directly in this folder. Names are CASE-SENSITIVE on the live
site (Vercel), so keep them exactly as written. Only Kooyonga material here.

LOGO (resting artwork on every video)  — NOT YET SUPPLIED
  kooyonga-logo.png            Original colours/proportions. Shown uncropped on white,
                               never enlarged past 2x its own size — the larger the
                               source file, the crisper it looks (1000px+ is ideal).

  Until this file is added the player rests on the course name set in Playfair,
  which is a clean card in its own right. Drop the file in and it takes over
  automatically — no config change needed.

VIDEO
  KooyongaHole16.mp4           Hole 16 · 30s · tee to green, one continuous shot

  SOURCE WAS HEVC. The camera/render original (KooyongaHole16.mp4, 156.8 MB,
  hevc/H.265) does NOT play in Chrome or Firefox, and at 156.8 MB exceeded
  GitHub's 100 MB per-file limit. The copy here was re-encoded to H.264 —
  the same codec as every other CourseVista film — and compressed for mobile:

    156.8 MB  ->  30.5 MB       (-81%)
    hevc      ->  h264 high@4.0, yuv420p
    1920x1080, 24 fps kept; AAC 128k stereo
    +faststart (index at the front, so it streams instead of downloading first)

  The command used, if a replacement is ever needed:
    ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.0 \
      -pix_fmt yuv420p -vf "scale=1920:1080:flags=lanczos" -r 24 \
      -c:a aac -b:a 128k -ac 2 -movflags +faststart KooyongaHole16.mp4

  Keep the HEVC original in cold storage as the master. Do not publish it.

HOLE 16 — source photographs + flight path
  kooyonga-hole16-img1.jpg
  kooyonga-hole16-img2.jpg
  kooyonga-hole16-img3.jpg
  kooyonga-hole16-img4.jpg
  kooyonga-hole16-img5.jpg
  kooyonga-hole16-img6.jpg
  kooyonga-hole16-img7.jpg
  kooyonga-hole16-img8.jpg
  kooyonga-hole16-flightpath.jpg

  Supplied as PNGs (25 MB total). Converted to JPEG at 1920px wide for delivery
  — 4.2 MB total, an 83% reduction with no visible difference at the sizes the
  page shows them. Originals kept in cold storage.

Anything listed but not uploaded is simply left out of the page (no broken
players or thumbnails). To change names or add a hole, edit
/demo/configs/kooyonga.js.

course.holes is set to 18 in that config, so prices are locked to 18 holes and
the 9/18/27/36 selector is hidden. Set it to null if that ever needs revisiting.
Optionally still to set: handoff.website / handoff.city.
