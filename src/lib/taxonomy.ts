// Regions/countries and business categories offered in the search form.
// Country codes are the ones the Apify Google Maps actor accepts (UK is "gb").

export type Country = { code: string; name: string };
export type Region = { name: string; flag: string; countries: Country[] };

export const REGIONS: Region[] = [
  {
    name: "North America",
    flag: "🌎",
    countries: [
      { code: "us", name: "United States" },
      { code: "ca", name: "Canada" },
    ],
  },
  {
    name: "Western & Northern Europe",
    flag: "🇪🇺",
    countries: [
      { code: "gb", name: "United Kingdom" },
      { code: "de", name: "Germany" },
      { code: "fr", name: "France" },
      { code: "nl", name: "Netherlands" },
      { code: "ch", name: "Switzerland" },
      { code: "ie", name: "Ireland" },
      { code: "be", name: "Belgium" },
      { code: "at", name: "Austria" },
      { code: "se", name: "Sweden" },
      { code: "no", name: "Norway" },
      { code: "dk", name: "Denmark" },
      { code: "fi", name: "Finland" },
    ],
  },
  {
    name: "Oceania",
    flag: "🇦🇺",
    countries: [
      { code: "au", name: "Australia" },
      { code: "nz", name: "New Zealand" },
    ],
  },
  {
    name: "Middle East",
    flag: "🐫",
    countries: [
      { code: "ae", name: "United Arab Emirates (UAE)" },
      { code: "sa", name: "Saudi Arabia" },
      { code: "qa", name: "Qatar" },
    ],
  },
];

// Major business cities per country, shown as pick-list in the search form.
export const CITIES: Record<string, string[]> = {
  us: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin", "San Francisco", "Seattle", "Denver", "Boston", "Miami", "Atlanta", "Nashville", "Las Vegas", "Washington", "Orlando", "Tampa", "Charlotte", "Portland", "San Jose", "Minneapolis"],
  ca: ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Victoria", "Halifax", "Mississauga"],
  gb: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Liverpool", "Edinburgh", "Bristol", "Sheffield", "Newcastle upon Tyne", "Nottingham", "Leicester", "Cardiff", "Belfast", "Brighton", "Cambridge", "Oxford"],
  de: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hanover", "Nuremberg"],
  fr: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille", "Rennes", "Cannes"],
  nl: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Haarlem"],
  ch: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Lucerne", "St. Gallen", "Lugano", "Winterthur", "Zug"],
  ie: ["Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kilkenny", "Drogheda", "Dundalk"],
  be: ["Brussels", "Antwerp", "Ghent", "Bruges", "Liège", "Leuven", "Namur", "Charleroi"],
  at: ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels"],
  se: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping", "Helsingborg"],
  no: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Kristiansand", "Tromsø", "Fredrikstad"],
  dk: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Vejle"],
  fi: ["Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä", "Lahti"],
  au: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Newcastle", "Hobart", "Darwin", "Sunshine Coast", "Geelong"],
  nz: ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Dunedin", "Queenstown", "Napier"],
  ae: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Al Ain", "Umm Al Quwain"],
  sa: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran", "Tabuk", "Abha"],
  qa: ["Doha", "Al Rayyan", "Al Wakrah", "Lusail", "Al Khor", "Umm Salal"],
};

export const COUNTRIES: Country[] = REGIONS.flatMap((r) => r.countries);

export function countryName(code: string | null | undefined) {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code ?? "";
}

// `query` is the search term sent to Google Maps.
export type Category = { label: string; query: string };
export type CategoryGroup = { name: string; icon: string; categories: Category[] };

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    name: "Hospitality & Leisure",
    icon: "🍽️",
    categories: [
      { label: "Restaurants & Cafes", query: "restaurant" },
      { label: "Boutique Hotels & Airbnbs", query: "boutique hotel" },
      { label: "Bars, Pubs & Nightclubs", query: "bar" },
      { label: "Catering Businesses", query: "catering service" },
    ],
  },
  {
    name: "Health, Fitness & Wellness",
    icon: "🏋️",
    categories: [
      { label: "Gyms & CrossFit Boxes", query: "gym" },
      { label: "Yoga & Pilates Studios", query: "yoga studio" },
      { label: "Personal Trainers & Nutritionists", query: "personal trainer" },
      { label: "Spas & Massage Clinics", query: "day spa" },
    ],
  },
  {
    name: "High-Ticket Home Services",
    icon: "🔨",
    categories: [
      { label: "Roofing & Construction Companies", query: "roofing contractor" },
      { label: "Plumbing & HVAC Contractors", query: "plumber" },
      { label: "Landscaping & Tree Services", query: "landscaping" },
      { label: "Interior Designers & Architects", query: "interior designer" },
    ],
  },
  {
    name: "Professional Services",
    icon: "💼",
    categories: [
      { label: "Law Firms & Attorneys", query: "law firm" },
      { label: "Accounting & Tax Consultants", query: "accountant" },
      { label: "Real Estate Agencies", query: "real estate agency" },
      { label: "Recruitment & Staffing Agencies", query: "recruitment agency" },
    ],
  },
  {
    name: "Medical Practices",
    icon: "🩺",
    categories: [
      { label: "Dental Clinics", query: "dental clinic" },
      { label: "Chiropractors & Physiotherapists", query: "chiropractor" },
      { label: "Veterinary Clinics", query: "veterinary clinic" },
      { label: "Dermatology & Aesthetics Clinics", query: "aesthetics clinic" },
    ],
  },
  {
    name: "Retail & Niche E-Commerce",
    icon: "📦",
    categories: [
      { label: "Local Boutiques & Clothing Stores", query: "clothing boutique" },
      { label: "Specialty Flower Shops", query: "florist" },
      { label: "Art Galleries & Local Artists", query: "art gallery" },
    ],
  },
];

export const CATEGORIES = CATEGORY_GROUPS.flatMap((g) =>
  g.categories.map((c) => ({ ...c, group: g.name })),
);

export function findCategory(label: string) {
  return CATEGORIES.find((c) => c.label === label);
}
