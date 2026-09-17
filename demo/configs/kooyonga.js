// Kooyonga Golf Club — client demo (/demo/kooyonga).
// Everything the page shows comes from this object; the layout is /demo/demo.js.
// Files this config expects are listed in /demo/kooyonga/assets/README.txt.
window.CV_DEMO = {
  slug: 'kooyonga',
  course: {
    name: 'Kooyonga Golf Club',
    shortName: 'Kooyonga',
    // Full-course hole count — NOT the number of preview videos. Kooyonga is an
    // 18-hole championship course, so prices lock to 18 and the 9/18/27/36
    // selector is replaced by a fixed line. Set to null to show the selector.
    holes: 18,
    // Resting artwork for every video: the club logo, uncropped, on a solid
    // ground. This is the crest-and-wordmark lockup taken from the hole 16
    // course overview below, so the page and the gifted artwork carry exactly
    // the same mark. Never substitute another club's artwork.
    logo: {
      src: '/demo/kooyonga/assets/kooyonga-logo.png',
      alt: 'Kooyonga Golf Club',
      background: '#FFFFFF',
      textColor: '#16170F'
    }
  },
  intro: {
    eyebrow: 'Prepared for Kooyonga Golf Club',
    heading: 'Kooyonga, in motion.',
    copy: 'Your sixteenth, built tee to green from photography alone. Explore it below, then choose a package for the full course.'
  },
  suggestedPackage: 'complete',
  alternativePackage: 'hosted',
  // Preview flyover only — separate from the full-course coverage a package buys.
  // File names are case-sensitive on the live site and match the uploaded files
  // exactly. Any file not yet uploaded is skipped: no broken players or thumbnails.
  videos: [
    {
      src: '/demo/kooyonga/assets/KooyongaHole16.mp4',
      label: 'Hole 16', detail: 'Tee to green · one continuous shot',
      sources: [
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img1.jpg', caption: 'Photo 1' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img2.jpg', caption: 'Photo 2' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img3.jpg', caption: 'Photo 3' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img4.jpg', caption: 'Photo 4' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img5.jpg', caption: 'Photo 5' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img6.jpg', caption: 'Photo 6' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img7.jpg', caption: 'Photo 7' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-img8.jpg', caption: 'Photo 8' },
        { src: '/demo/kooyonga/assets/kooyonga-hole16-flightpath.jpg', caption: 'Flight path' }
      ]
    }
  ],
  emptyFilmsNote: 'Your Kooyonga flyover will appear here as soon as it’s ready.',
  // Three treatments carried inside the one continuous hole 16 pass. Spans were
  // read off the film itself: the luminance curve climbs through the corridor,
  // troughs at ~0:18 as the shot lifts over the treeline, then rises hard into
  // the high-key green complex. Picking one seeks the film to that span.
  // Presentation only — the choice is not written into the order.
  styles: {
    heading: 'Three looks, one hole. Choose the one that suits Kooyonga.',
    copy: 'Your sixteenth was shot as a single unbroken pass, and it moves through three distinct treatments along the way. Play each below. Whichever you choose is the look we build across all eighteen holes, so the course reads as one piece of work rather than eighteen separate films.',
    items: [
      {
        name: 'Raking gold',
        from: 0, to: 10,
        poster: '/demo/kooyonga/assets/kooyonga-style-1.jpg',
        detail: 'Low sun driven straight down the corridor. Long shadows rake across the fairway and the tree line glows from the side. Warm, intimate, and the most dramatic of the three.'
      },
      {
        name: 'Open horizon',
        from: 10, to: 19,
        poster: '/demo/kooyonga/assets/kooyonga-style-2.jpg',
        detail: 'The shot lifts above the treeline and the sky opens up behind the hole. Cooler and cleaner, with the Adelaide skyline on the horizon — the look that best shows where the course sits.'
      },
      {
        name: 'Overhead clarity',
        from: 19, to: 30,
        poster: '/demo/kooyonga/assets/kooyonga-style-3.jpg',
        detail: 'High and square over the green complex, backlight blooming through the gums. Bunkering and contour read with the most definition here — the most useful for showing how a hole actually plays.'
      }
    ]
  },
  // Standing acknowledgement. Recognition only — it does not change any price;
  // the packages below stay at catalogue rates.
  recognition: {
    badge: 'Founding Course Beneficiary',
    heading: 'The hole that changed how we build.',
    body: [
      'Kooyonga’s sixteenth asked more of us than any hole we had filmed. The way the corridor moves and the ground falls meant our existing approach could not hold a single continuous shot together from tee to green — the film came apart at exactly the point the hole becomes interesting.',
      'So we built new methods for it. Rather than cutting the hole into pieces and hiding the joins, we developed a way to carry one unbroken movement across the whole corridor, holding the terrain, the light and the line of play consistent from the first frame to the last. The flyover above is the result, and it runs as one continuous shot.',
      'Those methods are now part of how every CourseVista course is made. Kooyonga is the course that produced them, and the first to be delivered under the standard they set.'
    ],
    // The token itself: a rendered overview of the sixteenth, given to the club
    // outright. Yours to use anywhere — scorecards, signage, the website — with
    // no charge and no conditions.
    gift: {
      label: 'Our thanks, yours to keep',
      src: '/demo/kooyonga/assets/kooyonga-hole16-coursemap.jpg',
      alt: 'Kooyonga Golf Club hole 16 course overview, tee to green',
      caption: 'The sixteenth, rendered tee to green. Yours outright — print it, publish it, put it on the card. No charge, no conditions, whatever you decide about the rest.'
    },
    points: [
      ['Named as a founding course', 'Kooyonga is recognised, on the record, as the course whose terrain advanced our production method.'],
      ['The technique carries your name', 'The continuity work developed on your sixteenth is now applied to every course we film.'],
      ['The overview is yours', 'The rendered sixteenth above is given outright, with full rights to use it however you like.']
    ],
    signoff: 'With our thanks — a difficult hole made the work better for every course that follows.'
  },
  // Known course details carried into /start. Add website/city once confirmed.
  handoff: {
    club: 'Kooyonga Golf Club',
    region: 'SA',
    country: 'Australia'
  },
  production: true,
  footnote: null
};
