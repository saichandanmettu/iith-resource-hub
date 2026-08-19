/**
 * Dummy resource data — mirrors the shape the real WordPress/ACF taxonomy
 * will eventually provide. Swap `fetchResources()` for a real API call
 * once the taxonomy/endpoint is available; the rest of the app only
 * depends on this array's shape.
 */

const DEPARTMENTS = [
  { code: "AI", name: "Artificial Intelligence" },
  { code: "BM", name: "Biomedical Engineering" },
  { code: "BT", name: "Biotechnology" },
  { code: "CE", name: "Civil Engineering" },
  { code: "CH", name: "Chemistry" },
  { code: "CO", name: "Computational Engineering" },
  { code: "CS", name: "Computer Science" },
  { code: "EE", name: "Electrical Engineering" },
  { code: "EP", name: "Engineering Physics" },
  { code: "ES", name: "Earth Sciences" },
  { code: "IC", name: "Interdisciplinary" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "MSME", name: "Materials Science & Metallurgy" },
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
    course: "Modern Physics", type: "papers", professor: "—", year: 2024,
    fileType: "pdf", pages: 6, downloads: 214,
  },
  {
    id: 2, title: "Materials Chemistry — Quiz 2", department: "MSME", semester: 2,
    course: "Materials Chemistry", type: "papers", professor: "Atul Deshpande", year: 2024,
    fileType: "pdf", pages: 3, downloads: 132,
  },
  {
    id: 3, title: "Materials Chemistry — Quiz 1", department: "MSME", semester: 2,
    course: "Materials Chemistry", type: "papers", professor: "Atul Deshpande", year: 2024,
    fileType: "pdf", pages: 2, downloads: 121,
  },
  {
    id: 4, title: "Differential Equations — Quiz", department: "MSME", semester: 2,
    course: "Differential Equations", type: "papers", professor: "Dhriti Sundar Patra", year: 2024,
    fileType: "pdf", pages: 4, downloads: 98,
  },
  {
    id: 5, title: "Elementary Linear Algebra — Notes", department: "CS", semester: 1,
    course: "Elementary Linear Algebra", type: "notes", professor: "Amit Tripathi", year: 2024,
    fileType: "pdf", pages: 42, downloads: 301,
  },
  {
    id: 6, title: "Mechanics of Solids — Quiz 4", department: "ME", semester: 3,
    course: "Mechanics of Solids", type: "papers", professor: "Prabhat Kumar", year: 2024,
    fileType: "pdf", pages: 3, downloads: 87,
  },
  {
    id: 7, title: "Introduction to Climate Change — Notes", department: "ES", semester: 1,
    course: "Introduction to Climate Change", type: "notes", professor: "Pritha Chatterjee, Deepu J Babu", year: 2024,
    fileType: "pdf", pages: 28, downloads: 156,
  },
  {
    id: 8, title: "Communication Skills — Quiz 2", department: "IC", semester: 1,
    course: "Communication Skills", type: "papers", professor: "Srirupa Chatterjee", year: 2024,
    fileType: "pdf", pages: 2, downloads: 64,
  },
  {
    id: 9, title: "Calculus-I — Question Paper", department: "CS", semester: 1,
    course: "Calculus-I", type: "papers", professor: "Jyotirmoy Rana, Vikas Krishnamurthy", year: 2024,
    fileType: "pdf", pages: 5, downloads: 245,
  },
  {
    id: 10, title: "Maths for Physics — End-Sem Paper", department: "EP", semester: 2,
    course: "Maths for Physics", type: "papers", professor: "Alok Pan", year: 2024,
    fileType: "pdf", pages: 7, downloads: 112,
  },
  {
    id: 11, title: "Calculus-II — Question Paper & Solutions", department: "CS", semester: 2,
    course: "Calculus-II", type: "papers", professor: "Rajesh Kannan, Sukumar", year: 2024,
    fileType: "pdf", pages: 9, downloads: 289,
  },
  {
    id: 12, title: "Intro to Materials Science — Question Paper", department: "MSME", semester: 2,
    course: "Introduction to Materials Science and Engineering", type: "papers", professor: "Ranjith Ramadurai", year: 2023,
    fileType: "pdf", pages: 6, downloads: 77,
  },
  {
    id: 13, title: "Environmental Chemistry — End-Sem Paper", department: "CH", semester: 4,
    course: "Environmental Chemistry", type: "papers", professor: "Sudharshanam", year: 2023,
    fileType: "pdf", pages: 5, downloads: 59,
  },
  {
    id: 14, title: "Complex Analysis — Notes", department: "EP", semester: 3,
    course: "Complex Analysis", type: "notes", professor: "Alok Pan", year: 2024,
    fileType: "pdf", pages: 51, downloads: 198,
  },
  {
    id: 15, title: "Calculus-II — Assignment", department: "CS", semester: 2,
    course: "Calculus-II", type: "assignment", professor: "Sukumar, Rajesh Kannan", year: 2024,
    fileType: "pdf", pages: 3, downloads: 143,
  },
  {
    id: 16, title: "Vector Calculus — Notes", department: "EP", semester: 2,
    course: "Vector Calculus", type: "notes", professor: "Alok Pan", year: 2024,
    fileType: "pdf", pages: 33, downloads: 176,
  },
  {
    id: 17, title: "Database Management Systems — Reference Guide", department: "CS", semester: 5,
    course: "Database Management Systems", type: "reference", professor: "—", year: 2024,
    fileType: "pdf", pages: 210, downloads: 312,
  },
  {
    id: 18, title: "Digital Circuits — Lab Assignment Set", department: "EE", semester: 3,
    course: "Digital Circuits", type: "assignment", professor: "—", year: 2024,
    fileType: "zip", pages: null, downloads: 91,
  },
  {
    id: 19, title: "Operating Systems — Notes Bundle", department: "CS", semester: 5,
    course: "Operating Systems", type: "notes", professor: "—", year: 2024,
    fileType: "pdf", pages: 88, downloads: 264,
  },
  {
    id: 20, title: "Optimization Techniques — Reference Book", department: "CO", semester: 6,
    course: "Optimization Techniques", type: "reference", professor: "—", year: 2023,
    fileType: "pdf", pages: 340, downloads: 145,
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
