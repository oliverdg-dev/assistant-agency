// The hiring process, written once. The homepage shows the short lines, the
// How It Works page shows the full descriptions, and the job request form's
// success screen shows steps 2-5 as "what happens next".
export interface ProcessStep {
  title: string;
  short: string;
  detail: string;
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    title: "Tell us what you need",
    short: "Share the role, the skills it needs and when you'd like someone to start.",
    detail:
      "Share your role requirements, priorities and timeline through our job request form. Once submitted, our team begins the process and confirms next steps with you.",
  },
  {
    title: "We clarify the role",
    short: "We review your request and agree on the ideal candidate profile with you.",
    detail:
      "Our team reviews your requirements and defines the ideal candidate profile within our network of Filipino professionals. We align on expectations, scope and success criteria before sourcing begins.",
  },
  {
    title: "We source and vet candidates",
    short: "We handle sourcing, screening, interviews and background checks.",
    detail:
      "We source candidates from our pool of Filipino professionals and run screening, skills validation and background checks. Only candidates who meet our standards move forward.",
  },
  {
    title: "You meet your shortlist",
    short: "You receive a shortlist of vetted candidates, with updates along the way.",
    detail:
      "You receive a shortlist of fully vetted candidates. Throughout this stage we keep you updated on progress, candidate status and timelines.",
  },
  {
    title: "We help you onboard",
    short: "Choose your hire and we support onboarding so they start smoothly.",
    detail:
      "We handle interviews and candidate evaluations and present only fully vetted professionals. Once you select your preferred candidate, we support onboarding to ensure a smooth start.",
  },
];
