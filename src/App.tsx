import { lazy, Suspense, useEffect, useRef } from "react";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { ButtonLink, Container } from "./components/ui";
import { useRoute } from "./lib/router";
import BookingPage from "./pages/Booking";
import CaseStudiesPage from "./pages/CaseStudies";
import HomePage from "./pages/Home";
import HowItWorksPage from "./pages/HowItWorks";
import LegalPage from "./pages/Legal";
import ServicesPage from "./pages/Services";

// The staff area is its own bundle, downloaded only on /admin/* pages.
const AdminApp = lazy(() => import("./admin/AdminApp"));
// The client's shortlist page, also its own bundle.
const ShortlistPage = lazy(() => import("./shortlist/ShortlistPage"));

const NotFound = () => (
  <section className="py-24 md:py-32">
    <Container className="max-w-2xl">
      <h1 className="text-4xl md:text-5xl">Page not found</h1>
      <p className="mt-4 text-lg text-ink-muted">
        The page you're looking for doesn't exist or has moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="home">Go to the homepage</ButtonLink>
        <ButtonLink to="booking" variant="secondary">
          Tell us what you need
        </ButtonLink>
      </div>
    </Container>
  </section>
);

export default function App() {
  const route = useRoute();
  const currentPage = route.page;

  // On a real page change (not a query-only change such as a form step), start
  // at the top and move focus to the new page's heading so screen readers
  // announce it. Skipped on first load.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [currentPage]);

  const renderPage = () => {
    switch (currentPage) {
      case "services":
        return <ServicesPage />;
      case "how-it-works":
        return <HowItWorksPage />;
      case "booking":
        return <BookingPage />;
      case "case-studies":
        return <CaseStudiesPage />;
      case "privacy":
      case "terms":
      case "cookies":
        return <LegalPage type={currentPage} />;
      case "not-found":
        return <NotFound />;
      default:
        return <HomePage />;
    }
  };

  if (currentPage === "shortlist") {
    return (
      <Suspense fallback={<main id="main" className="min-h-screen bg-surface" />}>
        <ShortlistPage />
      </Suspense>
    );
  }

  if (currentPage.startsWith("admin-")) {
    return (
      <Suspense fallback={<main id="main" className="min-h-screen bg-surface" />}>
        <AdminApp route={route} />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader currentPage={currentPage} />
      <main id="main" key={currentPage} className="page-enter flex-1">
        {renderPage()}
      </main>
      <SiteFooter />
    </div>
  );
}
