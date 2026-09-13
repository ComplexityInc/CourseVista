// Mount Osmond Golf Club — client demo (/demo/mt-osmond).
// Everything the page shows comes from this object; the layout is /demo/demo.js.
// Files this config expects are listed in /demo/mt-osmond/assets/README.txt.
window.CV_DEMO = {
  slug: 'mt-osmond',
  course: {
    name: 'Mount Osmond Golf Club',
    shortName: 'Mount Osmond',
    // Full-course hole count from the verified project record — NOT the number
    // of preview videos. No record was available when this page was built, so
    // it is left unset and the page shows the 9/18/27/36 selector. Set it
    // (e.g. holes: 18) once confirmed; prices then lock to that count.
    holes: null,
    // Resting artwork for every video: the club logo, uncropped, on a solid ground.
    logo: {
      src: '/demo/mt-osmond/assets/mtosmond-logo.png',
      alt: 'Mount Osmond Golf Club',
      background: '#FFFFFF',
      textColor: '#16170F'
    }
  },
  intro: {
    eyebrow: 'Prepared for Mount Osmond Golf Club',
    heading: 'Mount Osmond, in motion.',
    copy: 'Explore your flyovers below, then choose a package for the full course.'
  },
  suggestedPackage: 'complete',
  alternativePackage: 'hosted',
  // Preview flyovers only — separate from the full-course coverage a package buys.
  // Hole numbers were matched frame-by-frame against the original hole renders
  // (hole1VidMtOsmond / mtosmond-Hole3Video / hole16VidMtOsmond).
  // File names are case-sensitive on the live site and match the supplied files exactly.
  // Any file not yet uploaded is skipped: no broken players or thumbnails.
  videos: [
    {
      src: '/demo/mt-osmond/assets/MtOsmondDemo-1.mp4',
      label: 'Hole 1', detail: 'Tee to green',
      sources: [
        { src: '/demo/mt-osmond/assets/mtosmond-Hole1Img.png', caption: 'Photo 1' },
        { src: '/demo/mt-osmond/assets/mtosmond-Hole1Img2.png', caption: 'Photo 2' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole1Img3.png', caption: 'Photo 3' },
        { src: '/demo/mt-osmond/assets/mtosmond-Hole1Img4.png', caption: 'Photo 4' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole1map.jpg', caption: 'Hole map' }
      ]
    },
    {
      src: '/demo/mt-osmond/assets/MtOsmondDemo-2.mp4',
      label: 'Hole 3', detail: 'Tee to green',
      sources: [
        { src: '/demo/mt-osmond/assets/mtosmond-hole3img1.png', caption: 'Photo 1' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole3img2.png', caption: 'Photo 2' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole3img3.png', caption: 'Photo 3' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole3img4.png', caption: 'Photo 4' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole3map.jpg', caption: 'Hole map' }
      ]
    },
    {
      src: '/demo/mt-osmond/assets/MtOsmondDemo-3.mp4',
      label: 'Hole 16', detail: 'Tee to green',
      sources: [
        { src: '/demo/mt-osmond/assets/mtosmond-hole16img1.png', caption: 'Photo 1' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole16img2.png', caption: 'Photo 2' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole16img3.png', caption: 'Photo 3' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole16img4.png', caption: 'Photo 4' },
        { src: '/demo/mt-osmond/assets/mtosmond-hole16map.jpg', caption: 'Hole map' }
      ]
    }
  ],
  emptyFilmsNote: 'Your Mount Osmond flyovers will appear here as soon as they’re ready.',
  // Known course details carried into /start. Add website/city once confirmed.
  handoff: {
    club: 'Mount Osmond Golf Club',
    region: 'SA',
    country: 'Australia'
  },
  production: true,
  footnote: null
};
