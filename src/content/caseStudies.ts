// Client case studies, as supplied by the team. `featured` controls whether a
// study may also appear on the homepage; keep it false until the client
// relationship and figures are confirmed for public use (see TODOS.md).
export interface CaseStudy {
  client: string;
  subtitle: string;
  industry: string;
  challenge: string;
  solution: string;
  outcome: string;
  results: Array<{ metric: string; label: string }>;
  quote: string;
  author: string;
  featured: boolean;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    client: "Henderson Consulting & Associates",
    subtitle: "Scaling delivery capacity without increasing overhead",
    industry: "Consulting / Technology advisory",
    challenge:
      "As project demand grew, Henderson needed to expand delivery capacity quickly, without increasing costs or overloading their internal team.",
    solution:
      "We deployed a dedicated team of pre-vetted Filipino professionals to support research, technical documentation and project execution. The team integrated into existing workflows and contributed from week one.",
    outcome: "A dedicated team supporting research, documentation and project delivery from week one.",
    results: [
      { metric: "40%", label: "Increase in delivery capacity" },
      { metric: "60%", label: "Lower hiring cost" },
      { metric: "2 weeks", label: "Full team integration" },
    ],
    quote:
      "The team integrated seamlessly and helped us scale without adding operational complexity.",
    author: "Henderson Consulting & Associates",
    // The operator's own company: needs disclosure or confirmation before featuring.
    featured: false,
  },
  {
    client: "Valencia Theater Seating",
    subtitle: "Taking daily store operations off the founder's plate",
    industry: "E-commerce / Operations",
    challenge:
      "As Valencia expanded into new product categories, the team faced a growing workload across product listings, customer inquiries and order coordination, limiting their ability to focus on growth and brand strategy.",
    solution:
      "We matched them with a dedicated e-commerce operations specialist from the Philippines, who took ownership of product updates, customer support and daily store operations within the first week.",
    outcome:
      "A dedicated e-commerce operations specialist took over product updates, customer support and daily store operations within the first week.",
    results: [
      { metric: "60%", label: "Reduction in operational workload" },
      { metric: "45%", label: "Faster product and listing updates" },
      { metric: "Day 5", label: "Fully onboarded and managing operations" },
    ],
    quote:
      "I was spending too much time on daily operations. Now everything runs smoothly, and I can focus on growing the brand.",
    author: "Valencia team",
    featured: true,
  },
];
