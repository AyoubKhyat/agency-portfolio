export const FALLBACK_PROJECTS = [
  { id: "1", slug: "hammam-nour", category: "web", url: "https://hammam-nour.vercel.app/", image: "/projects/hammam-nour.webp", tag: "Spa & Wellness", sortOrder: 0 },
  { id: "2", slug: "goudoukh", category: "web", url: "https://goudoukh-luxury-cars.vercel.app/", image: "/projects/goudoukh.webp", tag: "Luxury car rental", sortOrder: 1 },
  { id: "3", slug: "tannour", category: "web", url: "https://tannour.vercel.app/", image: "/projects/tannour.webp", tag: "E-commerce", sortOrder: 2 },
  { id: "4", slug: "terrene", category: "web", url: "https://terrene.webyms.com/", image: "/projects/terrene.webp", tag: "Architecture studio", sortOrder: 3 },
  { id: "5", slug: "victory-path", category: "app", url: "https://victory-path-beta.vercel.app/login", image: "/projects/victory-path-v2.webp", tag: "Web app", sortOrder: 4 },
  { id: "6", slug: "aylani-parfums", category: "web", url: "https://aylani-parfums.vercel.app", image: "/projects/aylani-parfums.webp", tag: "E-commerce Parfums", sortOrder: 5 },
];

export const FALLBACK_SLUGS = FALLBACK_PROJECTS.map((p) => p.slug);
