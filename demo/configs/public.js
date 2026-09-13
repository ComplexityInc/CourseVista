// Public demonstration page (/demo). Generic course — no client branding.
window.CV_DEMO = {
  slug: 'demo',
  course: null,
  intro: {
    eyebrow: 'Demonstration',
    heading: 'Course flyovers, built from photographs already online.',
    copy: 'Each film below was made without a site visit or a drone, using only images the course had already published. Watch them, then choose the coverage for your own course.'
  },
  suggestedPackage: 'complete',
  alternativePackage: 'hosted',
  videos: [
    {
      src: '/demo/assets/case-01.mp4', poster: '/demo/assets/case-01-poster.jpg',
      label: 'Opening hole', detail: 'Case study 01 · tee to green',
      sources: [
        { src: '/demo/assets/case-01-src-1.jpg', caption: 'Photo 1' },
        { src: '/demo/assets/case-01-src-2.jpg', caption: 'Photo 2' },
        { src: '/demo/assets/case-01-src-3.jpg', caption: 'Photo 3' },
        { src: '/demo/assets/case-01-src-4.jpg', caption: 'Photo 4' },
        { src: '/demo/assets/case-01-map.jpg', caption: 'Hole map' }
      ]
    },
    {
      src: '/demo/assets/case-02.mp4', poster: '/demo/assets/case-02-poster.jpg',
      label: 'Second hole', detail: 'Case study 02 · tee to green',
      sources: [
        { src: '/demo/assets/case-02-src-1.jpg', caption: 'Photo 1' },
        { src: '/demo/assets/case-02-src-2.jpg', caption: 'Photo 2' },
        { src: '/demo/assets/case-02-src-3.jpg', caption: 'Photo 3' },
        { src: '/demo/assets/case-02-src-4.jpg', caption: 'Photo 4' },
        { src: '/demo/assets/case-02-map.jpg', caption: 'Hole map' }
      ]
    },
    {
      src: '/demo/assets/case-03.mp4', poster: '/demo/assets/case-03-poster.jpg',
      label: 'Closing hole', detail: 'Case study 03 · tee to green',
      sources: [
        { src: '/demo/assets/case-03-src-1.jpg', caption: 'Photo 1' },
        { src: '/demo/assets/case-03-src-2.jpg', caption: 'Photo 2' },
        { src: '/demo/assets/case-03-src-3.jpg', caption: 'Photo 3' },
        { src: '/demo/assets/case-03-src-4.jpg', caption: 'Photo 4' },
        { src: '/demo/assets/case-03-map.jpg', caption: 'Hole map' }
      ]
    }
  ],
  handoff: null,
  production: true,
  footnote: 'These films were made as a demonstration from photographs a course had already published. The course did not commission them and was not involved.'
};
