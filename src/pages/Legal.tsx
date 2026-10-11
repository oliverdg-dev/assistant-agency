import { BRAND } from "../../api/_lib/brand.js";
import { PageHeader } from "../components/ui";

type LegalType = "privacy" | "terms" | "cookies";

interface Section {
  heading: string;
  body: string;
}

interface LegalContent {
  title: string;
  subtitle: string;
  updated: string;
  sections: Section[];
}

const content: Record<LegalType, LegalContent> = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "How we collect, use, and protect your information.",
    updated: "January 1, 2024",
    sections: [
      {
        heading: "1. Information We Collect",
        body: `We collect information you provide directly to us when you submit a job request, or contact us. This may include your name, email address, company name, and requirements.\n\nWe also automatically collect certain information when you use our website, including log data, device information, and usage data through cookies and similar tracking technologies.`,
      },
      {
        heading: "2. How We Use Your Information",
        body: `We use the information we collect to:\n• Provide, maintain, and improve our talent matching services\n• Process and fulfil your job requests\n• Send you communications related to your inquiries\n• Analyse usage patterns to improve our platform\n• Comply with legal obligations\n• Protect against fraudulent or illegal activity`,
      },
      {
        heading: "3. Information Sharing",
        body: `We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. We may share your information with trusted third parties who assist us in operating our website and conducting our business, as long as those parties agree to keep this information confidential.\n\nWe may also disclose your information when we believe disclosure is appropriate to comply with the law, enforce our site policies, or protect ours or others' rights, property, or safety.`,
      },
      {
        heading: "4. Data Retention",
        body: `We retain your personal information for as long as necessary to fulfil the purposes outlined in this policy, unless a longer retention period is required or permitted by law. When your information is no longer needed, we will securely delete or anonymise it.`,
      },
      {
        heading: "5. Your Rights",
        body: `You have the right to:\n• Access the personal information we hold about you\n• Correct inaccurate or incomplete data\n• Request deletion of your personal data\n• Restrict or object to how we process your data\n• Receive a portable copy of your data\n\nTo exercise these rights, contact us at ${BRAND.privacyEmail}.`,
      },
      {
        heading: "6. Data Security",
        body: `We implement appropriate technical and organisational security measures to protect your information against unauthorised access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.`,
      },
      {
        heading: "7. Changes to This Policy",
        body: `We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date. We encourage you to review this policy periodically.`,
      },
      {
        heading: "8. Contact Us",
        body: `If you have any questions about this Privacy Policy, please contact us at:\n\n${BRAND.name}\nEmail: ${BRAND.privacyEmail}`,
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    subtitle: "The rules that govern your use of our services.",
    updated: "January 1, 2024",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: `By accessing or using ${BRAND.name}'s services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree to these terms, please do not use our services.`,
      },
      {
        heading: "2. Services Description",
        body: `${BRAND.name} provides talent acquisition and outsourcing services, connecting businesses with vetted Filipino professionals. Our services include talent matching, vetting, onboarding support, and ongoing placement management.`,
      },
      {
        heading: "3. Client Obligations",
        body: `As a client, you agree to:\n• Provide accurate and complete information about your requirements\n• Treat placed professionals with respect and in compliance with applicable employment laws\n• Maintain confidentiality of candidate information\n• Pay all fees as agreed upon in your service agreement\n• Notify us promptly of any issues with placed professionals`,
      },
      {
        heading: "4. Placement Fees",
        body: `Our placement fees are outlined in your individual service agreement. Fees are due as specified in that agreement. We reserve the right to modify our fee structure with 30 days' written notice to existing clients.`,
      },
      {
        heading: "5. The 90-Day Replacement Guarantee",
        body: `We offer a 90-day replacement guarantee on all placements. If a placed professional does not meet performance standards within the first 90 days through no fault of the client, we will find a replacement at no additional placement fee.\n\nThis guarantee does not apply if the placement ends due to changes in the client's business requirements, budget constraints, or misconduct by the client.`,
      },
      {
        heading: "6. Intellectual Property",
        body: `All content, trademarks, and materials on our website are the property of ${BRAND.name} and are protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.`,
      },
      {
        heading: "7. Limitation of Liability",
        body: `${BRAND.name} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services or reliance on any information provided, even if we have been advised of the possibility of such damages.\n\nOur total liability to you for any claims arising from these terms or your use of our services shall not exceed the fees paid by you in the 12 months preceding the claim.`,
      },
      {
        heading: "8. Termination",
        body: `Either party may terminate the service agreement with 30 days' written notice. We reserve the right to terminate immediately if you breach these terms or engage in conduct that is harmful to our professionals, reputation, or operations.`,
      },
      {
        heading: "9. Governing Law",
        body: `These terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without regard to its conflict of law provisions. Any disputes shall be resolved through binding arbitration in Manila.`,
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    subtitle: "How we use cookies and similar tracking technologies.",
    updated: "January 1, 2024",
    sections: [
      {
        heading: "1. What Are Cookies",
        body: `Cookies are small text files placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our site.`,
      },
      {
        heading: "2. Types of Cookies We Use",
        body: `Essential Cookies\nThese are necessary for our website to function properly and cannot be disabled. They enable core features like navigation and access to secure areas.\n\nAnalytics Cookies\nWe use analytics cookies (e.g., Google Analytics) to understand how visitors interact with our website. This helps us improve content and user experience. All data is anonymised.\n\nPreference Cookies\nThese remember your preferences — such as language or region — so you don't need to reset them on each visit.\n\nMarketing Cookies\nUsed to display relevant advertisements based on your browsing behaviour. These may be set by third-party advertising partners.`,
      },
      {
        heading: "3. Third-Party Cookies",
        body: `We use third-party services that may set their own cookies on your device. These include Google Analytics, LinkedIn Insight Tag, and Meta Pixel. Each third party has its own privacy policy governing the use of their cookies.`,
      },
      {
        heading: "4. Managing Cookies",
        body: `You can control and manage cookies through your browser settings. Most browsers allow you to:\n• View what cookies are stored\n• Delete individual or all cookies\n• Block third-party cookies\n• Block cookies from specific websites\n• Set preferences for future cookies\n\nPlease note that disabling certain cookies may affect the functionality of our website.`,
      },
      {
        heading: "5. Cookie Consent",
        body: `When you first visit our website, you will be asked to consent to our use of non-essential cookies. You can withdraw your consent at any time by adjusting your browser settings or contacting us directly.`,
      },
      {
        heading: "6. Cookie Retention",
        body: `Session cookies expire when you close your browser. Persistent cookies remain on your device for a set period — typically between 30 days and 2 years — depending on their purpose. You can delete persistent cookies at any time through your browser settings.`,
      },
      {
        heading: "7. Updates to This Policy",
        body: `We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our practices. We will post the updated policy on this page with a revised date.`,
      },
      {
        heading: "8. Contact Us",
        body: `If you have any questions about our use of cookies, please contact us at:\n\n${BRAND.name}\nEmail: ${BRAND.privacyEmail}`,
      },
    ],
  },
};

export default function LegalPage({ type }: { type: LegalType }) {
  const page = content[type];

  return (
    <>
      <PageHeader title={page.title} intro={page.subtitle}>
        <p className="mt-3 text-sm text-ink-subtle">Last updated: {page.updated}</p>
      </PageHeader>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="space-y-10">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl">{section.heading}</h2>
                <div className="mt-3 whitespace-pre-line leading-relaxed text-ink-muted">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-line pt-6 text-ink-muted">
            Questions about this policy? Email{" "}
            <a href={`mailto:${BRAND.privacyEmail}`} className="font-medium text-brand underline">
              {BRAND.privacyEmail}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
