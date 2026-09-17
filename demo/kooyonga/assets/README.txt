Kooyonga Golf Club — demo assets (/demo/kooyonga)

Put these files directly in this folder. Names are CASE-SENSITIVE on the live
site (Vercel), so keep them exactly as written. Only Kooyonga material here.

LOGO (resting artwork on every video)
  kooyonga-logo.png            580x118. The crest-and-wordmark lockup, cropped from
                               the top-left of the hole 16 course overview so the page
                               and the gifted artwork carry exactly the same mark.
                               Shown uncropped on white, never enlarged past 2x its
                               own size. If a higher-resolution club logo is supplied
                               later, replace this file — no config change needed.

FOUNDING COURSE BENEFICIARY GIFT
  kooyonga-hole16-coursemap.jpg   1947x808. The rendered hole 16 overview, tee to
                               green, presented in the recognition section as the
                               token given to the club outright. Source PNG was
                               1.7 MB; JPEG here is 387 KB.

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

STYLE REFERENCE STILLS (the three-look chooser)
  kooyonga-style-1.jpg         Raking gold      — frame at 0:04
  kooyonga-style-2.jpg         Open horizon     — frame at 0:14
  kooyonga-style-3.jpg         Overhead clarity — frame at 0:26

  Pulled straight from KooyongaHole16.mp4 so each card shows the exact look it
  plays. The spans (0:00-0:10, 0:10-0:19, 0:19-0:30) are set in
  /demo/configs/kooyonga.js. If the film is ever re-cut, re-grab these frames
  and update the spans together, or the cards will misrepresent the footage.

  NOTE: seeking to a span needs HTTP Range support. Vercel provides it; Python's
  http.server does NOT, so the chooser cannot be tested with `python -m http.server`
  — the film will just play from the start. Test on a Vercel preview instead.

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
