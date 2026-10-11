import { useState } from "react";
import { motion } from "motion/react";
import { Search, SlidersHorizontal, ArrowRight } from "lucide-react";
import type { Page } from "../lib/router";

// This page is hidden (not routed). Kept compiling until the team decides its future.
type NavigateFn = (page: Page) => void;

const talents = [
  {
    name: "Maria S.",
    role: "Senior Operations Manager",
    status: "Available Now",
    category: "VA",
    years: "8+ years",
    desc: "Expert in Shopify, HubSpot, and project architecture for 7-figure e-commerce brands.",
    skills: ["SHOPIFY", "HUBSPOT", "OPERATIONS", "PROJECT MGMT"],
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "James P.",
    role: "Lead Full-Stack Developer",
    status: "Interview Pending",
    category: "Developer",
    years: "6+ years",
    desc: "React/Next.js and AWS specialist. Proven track record building scalable SaaS products.",
    skills: ["REACT", "AWS", "NODE.JS", "ARCHITECTURE"],
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "Ana R.",
    role: "Digital Marketing Strategist",
    status: "Available Now",
    category: "Marketing",
    years: "5+ years",
    desc: "SEO and paid media expert who has generated over $2M in attributed revenue for e-commerce clients.",
    skills: ["SEO", "META ADS", "GOOGLE ADS", "CONTENT"],
    img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "Carlos M.",
    role: "React Native Developer",
    status: "Available Now",
    category: "Developer",
    years: "4+ years",
    desc: "Mobile-first developer with 12+ apps launched on both App Store and Google Play.",
    skills: ["REACT NATIVE", "TYPESCRIPT", "FIREBASE", "IOS/ANDROID"],
    img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "Sofia D.",
    role: "Executive Virtual Assistant",
    status: "Available Now",
    category: "VA",
    years: "7+ years",
    desc: "C-suite EA background supporting CEOs at Fortune 500 companies. Meticulous and highly discreet.",
    skills: ["EXECUTIVE SUPPORT", "CALENDARING", "TRAVEL", "REPORTING"],
    img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "Miguel T.",
    role: "SEO & Content Lead",
    status: "Hired",
    category: "Marketing",
    years: "6+ years",
    desc: "Grew organic traffic by 340% for a SaaS brand in 12 months. Expert in technical SEO and content clusters.",
    skills: ["TECHNICAL SEO", "AHREFS", "CONTENT STRATEGY", "COPYWRITING"],
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "Isabella V.",
    role: "UI/UX Designer",
    status: "Available Now",
    category: "Creative",
    years: "5+ years",
    desc: "Product designer specializing in SaaS dashboards and mobile apps. Strong user research background.",
    skills: ["FIGMA", "USER RESEARCH", "PROTOTYPING", "DESIGN SYSTEMS"],
    img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=400",
  },
  {
    name: "Jose L.",
    role: "Financial Analyst",
    status: "Interview Pending",
    category: "Finance",
    years: "9+ years",
    desc: "CPA with extensive experience in financial modeling, forecasting, and P&L management for growth-stage startups.",
    skills: ["CPA", "FINANCIAL MODELING", "QUICKBOOKS", "XERO"],
    img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
  },
];

const categories = ["All", "VA", "Developer", "Marketing", "Creative", "Finance"];
const statusOptions = ["All", "Available Now", "Interview Pending", "Hired"];

const statusStyle: Record<string, string> = {
  "Available Now": "bg-secondary/10 text-secondary",
  "Interview Pending": "bg-on-surface-variant/10 text-on-surface-variant",
  Hired: "bg-primary/10 text-primary",
};

export default function TalentPage({ navigate }: { navigate: NavigateFn }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeStatus, setActiveStatus] = useState("All");

  const filtered = talents.filter((t) => {
    const matchCategory = activeCategory === "All" || t.category === activeCategory;
    const matchStatus = activeStatus === "All" || t.status === activeStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.role.toLowerCase().includes(q) ||
      t.skills.some((s) => s.toLowerCase().includes(q));
    return matchCategory && matchStatus && matchSearch;
  });

  return (
    <div className="pt-20">
      {/* Header */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-secondary font-bold uppercase tracking-widest text-sm">
              The Roster
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mt-2 mb-6">
              Browse Talent
            </h1>
            <p className="text-xl text-on-surface-variant max-w-2xl">
              Every professional in our roster has passed our 4-stage vetting
              process. Browse and request interviews with your top picks.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Sticky Filters */}
      <section className="sticky top-20 z-40 bg-surface-container-lowest border-b border-outline-variant py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="text"
              placeholder="Search by role or skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full border border-outline-variant bg-surface-container-low text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status select */}
          <div className="flex items-center gap-2 ml-auto">
            <SlidersHorizontal size={14} className="text-on-surface-variant" />
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="text-sm border border-outline-variant rounded-lg px-3 py-1.5 bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {statusOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Talent Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-on-surface-variant text-lg mb-4">
                No talent found matching your criteria.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                  setActiveStatus("All");
                }}
                className="text-primary font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {filtered.map((talent, i) => (
                <motion.div
                  key={talent.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col sm:flex-row relative group ambient-shadow"
                >
                  <div className="sm:w-2/5 relative overflow-hidden min-h-48">
                    <img
                      src={talent.img}
                      alt={talent.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors" />
                  </div>
                  <div className="p-8 sm:w-3/5 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-extrabold">{talent.name}</h4>
                        <p className="text-primary font-bold text-sm">{talent.role}</p>
                        <p className="text-on-surface-variant text-xs mt-1">
                          {talent.years} experience
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                          statusStyle[talent.status] ??
                          "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {talent.status}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                      {talent.desc}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {talent.skills.map((skill, j) => (
                        <span
                          key={j}
                          className="text-[10px] border border-outline-variant px-2 py-1 rounded bg-surface-container-low font-bold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                    {talent.status !== "Hired" && (
                      <button
                        onClick={() => navigate("booking")}
                        className="text-primary text-sm font-bold flex items-center gap-1 hover:translate-x-1 transition-transform"
                      >
                        Request Interview <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <p className="text-center text-sm text-on-surface-variant mt-8">
              Showing {filtered.length} of {talents.length} professionals
            </p>
          )}
        </div>
      </section>

      {/* Custom Match CTA */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Don't see the <span className="text-primary">perfect match?</span>
          </h2>
          <p className="text-on-surface-variant text-xl mb-10">
            Submit a custom request and we'll search our full network of 2,400+
            pre-vetted professionals.
          </p>
          <button
            onClick={() => navigate("booking")}
            className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:scale-105 transition-transform mx-auto"
          >
            Submit Custom Request <ArrowRight size={20} />
          </button>
        </div>
      </section>
    </div>
  );
}
