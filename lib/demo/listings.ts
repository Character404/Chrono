/**
 * Businesses customers can browse in the prototype. Lerato's Kitchen is live (orders go to a real
 * business on Chrono). The others are sample listings for the demo: browsable, not orderable.
 */
export interface Offering {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  /** What the business usually spends to make it (used for the cash-flow check). */
  costCents: number;
  costLabel: string;
  /** Usual deposit before Chrono's check. */
  depositPercent: number;
  /** Days of notice the business needs. */
  leadDays: number;
  /** Optional photo of the item. */
  photo?: string;
}

export interface Listing {
  slug: string;
  name: string;
  area: string;
  kind: string;
  initials: string;
  colour: string;
  orderable: boolean;
  /** Cover image; defaults to the illustrated cover for the business. */
  cover?: string;
  tagline: string;
  offerings: Offering[];
}

export const LISTINGS: Listing[] = [
  {
    slug: "leratos-kitchen",
    name: "Lerato's Kitchen",
    area: "Soshanguve",
    kind: "Catering",
    initials: "LK",
    colour: "#E11D48",
    orderable: true,
    cover: "/listings/lerato/buffet.jpg",
    tagline: "Weddings, functions and parties, catered with care.",
    offerings: [
      { id: "wedding", name: "Wedding catering", description: "Full catering for about 50 guests.", priceCents: 500000, costCents: 320000, costLabel: "Ingredients", depositPercent: 20, leadDays: 7, photo: "/listings/lerato/buffet.jpg" },
      { id: "corporate", name: "Corporate lunch", description: "Lunch for about 20 people, delivered.", priceCents: 350000, costCents: 210000, costLabel: "Ingredients", depositPercent: 30, leadDays: 3, photo: "/listings/lerato/breakfast.jpg" },
      { id: "platter", name: "Birthday platter", description: "A party platter for about 15 people.", priceCents: 160000, costCents: 90000, costLabel: "Ingredients", depositPercent: 30, leadDays: 2, photo: "/listings/lerato/wings.jpg" },
      { id: "cake", name: "Birthday cake", description: "A two-tier celebration cake.", priceCents: 90000, costCents: 40000, costLabel: "Ingredients", depositPercent: 50, leadDays: 2 },
    ],
  },
  {
    slug: "mphos-bakes",
    name: "Mpho's Bakes",
    area: "Ga-Rankuwa",
    kind: "Baking",
    initials: "MB",
    colour: "#F59E0B",
    orderable: false,
    cover: "/listings/photos/bakery-counter.jpg",
    tagline: "Cakes and cupcakes for every celebration.",
    offerings: [
      { id: "cupcakes", name: "Cupcakes (24)", description: "Two dozen decorated cupcakes.", priceCents: 48000, costCents: 20000, costLabel: "Ingredients", depositPercent: 50, leadDays: 2, photo: "/listings/photos/cakes.jpg" },
      { id: "wedding-cake", name: "Wedding cake", description: "Three tiers, made to order.", priceCents: 280000, costCents: 120000, costLabel: "Ingredients", depositPercent: 40, leadDays: 14 },
    ],
  },
  {
    slug: "kea-events",
    name: "Kea Events Décor",
    area: "Soshanguve",
    kind: "Event décor",
    initials: "KE",
    colour: "#22B8CF",
    orderable: false,
    cover: "/listings/photos/decor-table.jpg",
    tagline: "Décor that turns a venue into an occasion.",
    offerings: [
      { id: "garden", name: "Garden party décor", description: "Tables, linen and flowers for 60 guests.", priceCents: 420000, costCents: 230000, costLabel: "Materials", depositPercent: 30, leadDays: 10, photo: "/listings/photos/decor-square.jpg" },
      { id: "baby-shower", name: "Baby shower set-up", description: "Balloons, backdrop and table styling.", priceCents: 150000, costCents: 70000, costLabel: "Materials", depositPercent: 40, leadDays: 5 },
    ],
  },
  {
    slug: "sizwe-tailoring",
    name: "Sizwe Tailoring",
    area: "Mabopane",
    kind: "Dressmaking",
    initials: "ST",
    colour: "#12B886",
    orderable: false,
    cover: "/listings/photos/tailoring.jpg",
    tagline: "Made-to-measure suits and dresses.",
    offerings: [
      { id: "suit", name: "Made-to-measure suit", description: "Two fittings, ready in two weeks.", priceCents: 320000, costCents: 150000, costLabel: "Materials", depositPercent: 50, leadDays: 14, photo: "/listings/photos/tailoring-square.jpg" },
      { id: "matric-dress", name: "Matric dance dress", description: "Designed with you, three fittings.", priceCents: 260000, costCents: 110000, costLabel: "Materials", depositPercent: 50, leadDays: 21 },
    ],
  },
];

export function getListing(slug: string): Listing | undefined {
  return LISTINGS.find((l) => l.slug === slug);
}

export function coverFor(listing: Listing): string {
  return listing.cover ?? `/listings/${listing.slug}.svg`;
}
