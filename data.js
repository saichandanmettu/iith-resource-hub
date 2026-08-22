/**
 * Dummy resource data — mirrors the shape the real WordPress/ACF taxonomy.
 * NOTE: `code` values here are PLACEHOLDERS in the right shape, used to build
 * and judge the card design. Replace them with the real course codes from
 * WordPress — nothing but this file needs to change.
 * mirrors the shape the real WordPress/ACF taxonomy
 * will eventually provide. Swap `fetchResources()` for a real API call
 * once the taxonomy/endpoint is available; the rest of the app only
 * depends on this array's shape.
 */

/* The BTech programmes IITH offers, alphabetical, as published by the
   institute. This is the single source of truth: the Library shelves, the
   department filter and the Contribute form all read from it.

   `accent` is decorative, not semantic: unlike the resource-kind colours
   (amber = past papers, olive = notes...) a branch colour carries no meaning,
   it just makes 15 pills tellable apart.

   `short` is what the pills and shelf headings use. Every programme here is
   an engineering programme, so repeating "Engineering" in each label costs
   width and says nothing; `name` keeps the full official title for the
   Contribute form, where precision matters. So every accent is derived from the
   four families the brand already owns, at four lightness steps, rather than
   introducing 15 new hues. */
const DEPARTMENTS = [
  { code: "AI",   name: "Artificial Intelligence", accent: "#F28700", short: "Artificial Intelligence" },
  { code: "BM",   name: "Biomedical Engineering", accent: "#698B39", short: "Biomedical" },
  { code: "BT",   name: "Biotechnology and Bioinformatics", accent: "#D04724", short: "Biotech & Bioinformatics" },
  { code: "CM",   name: "Chemical Engineering", accent: "#8C6597", short: "Chemical" },
  { code: "CE",   name: "Civil Engineering", accent: "#C26C00", short: "Civil" },
  { code: "CS",   name: "Computer Science and Engineering", accent: "#546F2E", short: "Computer Science" },
  { code: "CO",   name: "Computational Engineering", accent: "#A6391D", short: "Computational" },
  { code: "EE",   name: "Electrical Engineering", accent: "#705179", short: "Electrical" },
  { code: "EP",   name: "Engineering Physics", accent: "#FFAE47", short: "Engineering Physics" },
  { code: "ES",   name: "Engineering Science", accent: "#809C5A", short: "Engineering Science" },
  { code: "ICT",  name: "IC Design & Technology", accent: "#E97A5E", short: "IC Design" },
  { code: "IC",   name: "Industrial Chemistry", accent: "#A081A9", short: "Industrial Chemistry" },
  { code: "MSME", name: "Materials Science and Metallurgical Engineering", accent: "#9B5A08", short: "Materials Science" },
  { code: "MNC",  name: "Mathematics and Computing", accent: "#445927", short: "Maths & Computing" },
  { code: "ME",   name: "Mechanical and Aerospace Engineering", accent: "#85321D", short: "Mechanical & Aerospace" },
];

const RESOURCE_TYPES = [
  { id: "papers", label: "Quizzes / Past Papers", color: "var(--type-papers)" },
  { id: "notes", label: "Notes / Slides", color: "var(--type-notes)" },
  { id: "assignment", label: "Assignments", color: "var(--type-assignment)" },
  { id: "reference", label: "Reference Books", color: "var(--type-reference)" },
];

const RESOURCES = [
  {
    id: 1, title: "Modern Physics — Mid-Sem Paper", department: "EP", semester: 3,
    course: "Modern Physics", code: "PH2110", type: "papers", professor: "—", year: 2024,
    fileType: "pdf", pages: 6, downloads: 214,
  },
  {
    id: 2, title: "Materials Chemistry — Quiz 2", department: "MSME", semester: 2,
    course: "Materials Chemistry", code: "CY1120", type: "papers", professor: "Atul Deshpande", year: 2024,
    fileType: "pdf", pages: 3, downloads: 132,
  },
  {
    id: 3, title: "Materials Chemistry — Quiz 1", department: "MSME", semester: 2,
    course: "Materials Chemistry", code: "CY1120", type: "papers", professor: "Atul Deshpande", year: 2024,
    fileType: "pdf", pages: 2, downloads: 121,
  },
  {
    id: 4, title: "Differential Equations — Quiz", department: "MSME", semester: 2,
    course: "Differential Equations", code: "MA1310", type: "papers", professor: "Dhriti Sundar Patra", year: 2024,
    fileType: "pdf", pages: 4, downloads: 98,
  },
  {
    id: 5, title: "Elementary Linear Algebra — Notes", department: "CS", semester: 1,
    course: "Elementary Linear Algebra", code: "MA1010", type: "notes", professor: "Amit Tripathi", year: 2024,
    fileType: "pdf", pages: 42, downloads: 301,
  },
  {
    id: 6, title: "Mechanics of Solids — Quiz 4", department: "ME", semester: 3,
    course: "Mechanics of Solids", code: "ME2110", type: "papers", professor: "Prabhat Kumar", year: 2024,
    fileType: "pdf", pages: 3, downloads: 87,
  },
  {
    id: 7, title: "Introduction to Climate Change — Notes", department: "ES", semester: 1,
    course: "Introduction to Climate Change", code: "ES1110", type: "notes", professor: "Pritha Chatterjee, Deepu J Babu", year: 2024,
    fileType: "pdf", pages: 28, downloads: 156,
  },
  {
    id: 8, title: "Communication Skills — Quiz 2", department: "IC", semester: 1,
    course: "Communication Skills", code: "LA1010", type: "papers", professor: "Srirupa Chatterjee", year: 2024,
    fileType: "pdf", pages: 2, downloads: 64,
  },
  {
    id: 9, title: "Calculus-I — Question Paper", department: "CS", semester: 1,
    course: "Calculus-I", code: "MA1110", type: "papers", professor: "Jyotirmoy Rana, Vikas Krishnamurthy", year: 2024,
    fileType: "pdf", pages: 5, downloads: 245,
  },
  {
    id: 10, title: "Maths for Physics — End-Sem Paper", department: "EP", semester: 2,
    course: "Maths for Physics", code: "PH1210", type: "papers", professor: "Alok Pan", year: 2024,
    fileType: "pdf", pages: 7, downloads: 112,
  },
  {
    id: 11, title: "Calculus-II — Question Paper & Solutions", department: "CS", semester: 2,
    course: "Calculus-II", code: "MA1210", type: "papers", professor: "Rajesh Kannan, Sukumar", year: 2024,
    fileType: "pdf", pages: 9, downloads: 289,
  },
  {
    id: 12, title: "Intro to Materials Science — Question Paper", department: "MSME", semester: 2,
    course: "Introduction to Materials Science and Engineering", code: "MS1110", type: "papers", professor: "Ranjith Ramadurai", year: 2023,
    fileType: "pdf", pages: 6, downloads: 77,
  },
  {
    id: 13, title: "Environmental Chemistry — End-Sem Paper", department: "CM", semester: 4,
    course: "Environmental Chemistry", code: "CY2140", type: "papers", professor: "Sudharshanam", year: 2023,
    fileType: "pdf", pages: 5, downloads: 59,
  },
  {
    id: 14, title: "Complex Analysis — Notes", department: "EP", semester: 3,
    course: "Complex Analysis", code: "MA2210", type: "notes", professor: "Alok Pan", year: 2024,
    fileType: "pdf", pages: 51, downloads: 198,
  },
  {
    id: 15, title: "Calculus-II — Assignment", department: "CS", semester: 2,
    course: "Calculus-II", code: "MA1210", type: "assignment", professor: "Sukumar, Rajesh Kannan", year: 2024,
    fileType: "pdf", pages: 3, downloads: 143,
  },
  {
    id: 16, title: "Vector Calculus — Notes", department: "EP", semester: 2,
    course: "Vector Calculus", code: "MA2110", type: "notes", professor: "Alok Pan", year: 2024,
    fileType: "pdf", pages: 33, downloads: 176,
  },
  {
    id: 18, title: "Digital Circuits — Lab Assignment Set", department: "EE", semester: 3,
    course: "Digital Circuits", code: "EE2140", type: "assignment", professor: "—", year: 2024,
    fileType: "zip", pages: null, downloads: 91,
  },
  {
    id: 19, title: "Operating Systems — Notes Bundle", department: "CS", semester: 5,
    course: "Operating Systems", code: "CS3110", type: "notes", professor: "—", year: 2024,
    fileType: "pdf", pages: 88, downloads: 264,
  },
  {
    id: 17, title: "Database Management Systems — Reference Guide", department: "CS", semester: 5,
    course: "Database Management Systems", code: "CS2130", type: "reference", professor: "—", year: 2024,
    fileType: "pdf", pages: 210, downloads: 312,
    book: {
      author: "Silberschatz, Korth & Sudarshan", publisher: "McGraw-Hill", cover: "ink",
      gist: "The standard database text. Start at the relational model and normalisation — that is where most of the marks live.",
    },
  },
  {
    id: 20, title: "Optimization Techniques — Reference Book", department: "CO", semester: 6,
    course: "Optimization Techniques", code: "MA3110", type: "reference", professor: "—", year: 2023,
    fileType: "pdf", pages: 340, downloads: 145,
    book: {
      author: "Hamdy A. Taha", publisher: "Pearson", cover: "amber",
      gist: "Operations research from the ground up. The worked simplex examples are the fastest way into linear programming.",
    },
  },
  {
    id: 21, title: "Introduction to Algorithms — Reference Book", department: "CS", semester: 4,
    course: "Design and Analysis of Algorithms", code: "CS2110", type: "reference", professor: "—", year: 2024,
    fileType: "pdf", pages: 1312, downloads: 402,
    book: {
      author: "Cormen, Leiserson, Rivest & Stein", publisher: "MIT Press", cover: "crimson",
      gist: "Dense, complete, and the reference everyone eventually returns to. Read the chapter you need, not the book.",
    },
  },
  {
    id: 22, title: "Linear Algebra and Its Applications — Reference Book", department: "CS", semester: 1,
    course: "Elementary Linear Algebra", code: "MA1010", type: "reference", professor: "—", year: 2023,
    fileType: "pdf", pages: 576, downloads: 268,
    book: {
      author: "Gilbert Strang", publisher: "Cengage", cover: "mint",
      gist: "Geometry first, proofs second. The clearest explanation of what a matrix is actually doing to space.",
    },
  },
  {
    id: 23, title: "Materials Science and Engineering — Reference Book", department: "MSME", semester: 2,
    course: "Introduction to Materials Science and Engineering", code: "MS1110", type: "reference", professor: "—", year: 2023,
    fileType: "pdf", pages: 992, downloads: 176,
    book: {
      author: "William D. Callister", publisher: "Wiley", cover: "violet",
      gist: "Structure, properties, processing, performance. The four-way link the whole first-year syllabus is built on.",
    },
  },
  {
    id: 24, title: "Fluid Mechanics — Reference Book", department: "ME", semester: 4,
    course: "Fluid Mechanics", code: "ME2210", type: "reference", professor: "—", year: 2024,
    fileType: "pdf", pages: 780, downloads: 154,
    book: {
      author: "Frank M. White", publisher: "McGraw-Hill", cover: "sky",
      gist: "Heavy on worked problems. Control volume analysis is the chapter to get right before anything else.",
    },
  },
];

/**
 * Stand-in for the future live data call.
 * Later: replace body with `fetch(API_ENDPOINT).then(r => r.json())`
 * once the WordPress taxonomy/REST scheme is provided — the rest of
 * the app (rendering, filtering, sorting) doesn't need to change.
 */
async function fetchResources() {
  return Promise.resolve(RESOURCES);
}
