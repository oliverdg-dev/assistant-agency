export interface RoleEntry {
  // Must match a role name in roleGroups (api/_lib/booking.ts) exactly, so
  // "Request" opens the form with this role filled in.
  name: string;
  does: string;
  tasks: [string, string, string];
  tools: string;
}

export interface RoleGroup {
  id: string;
  // Must match a roleGroups label in api/_lib/booking.ts.
  category: string;
  title: string;
  intro: string;
  roles: RoleEntry[];
}

// What each role in the job request form actually does day to day. Task and
// tool lists come from docs/ROLE-RESEARCH.md; the software development roles
// and UI/UX Designer were not part of that research.
export const ROLE_GROUPS: RoleGroup[] = [
  {
    id: "admin",
    category: "Administrative & Virtual Support",
    title: "Administrative and executive support",
    intro: "People who take email, scheduling and paperwork off your plate.",
    roles: [
      {
        name: "Virtual Assistant",
        does: "A general assistant for the routine admin that eats your week: email, scheduling, data entry and follow-ups.",
        tasks: [
          "Sort your inbox and draft replies for you to approve",
          "Book and move meetings, and send reminders",
          "Enter orders, leads and client details into your CRM or spreadsheets",
        ],
        tools: "Google Workspace or Microsoft 365, Slack, your CRM, Asana or ClickUp",
      },
      {
        name: "Executive Assistant",
        does: "Runs one person's calendar, inbox and follow-ups, so that person only spends time on the decisions that need them.",
        tasks: [
          "Triage your inbox twice a day and draft replies for your approval",
          "Run your calendar: book, reschedule and protect focus time",
          "Chase vendors, staff and clients until open items are closed",
        ],
        tools: "Google Workspace or Microsoft 365, Calendly, Slack, ClickUp, Asana or Notion, Expensify",
      },
      {
        name: "Administrative Assistant",
        does: "Works your shared admin queue: the info@ inbox, data entry, document filing and templated replies to customers.",
        tasks: [
          "Clear the shared inbox and answer routine questions from saved replies",
          "Prepare proposals, letters and onboarding packs from templates",
          "File and tag documents in Google Drive or SharePoint",
        ],
        tools: "Gmail or Outlook, Google Sheets or Excel, DocuSign or PandaDoc, HubSpot",
      },
      {
        name: "Data Entry Specialist",
        does: "Enters and cleans the records your team relies on, accurately and on time.",
        tasks: [
          "Enter new leads, orders and client details the day they arrive",
          "Find and fix duplicates and missing fields in your CRM or sheets",
          "Update your weekly reporting sheet from the source systems",
        ],
        tools: "Google Sheets, Excel, Airtable, your CRM",
      },
    ],
  },
  {
    id: "support",
    category: "Customer Support & Success",
    title: "Customer support and success",
    intro: "People who answer your customers quickly and keep accounts healthy.",
    roles: [
      {
        name: "Customer Support Representative",
        does: "Answers customer emails, chats and messages about orders, shipping and returns, and fixes the order problems behind them.",
        tasks: [
          "Work the support queue to an agreed response time",
          "Handle order changes, returns, exchanges and refunds within your policy",
          "Chase carriers about lost or damaged parcels and arrange reshipments",
        ],
        tools: "Gorgias, Zendesk, Help Scout, Shopify, AfterShip",
      },
      {
        name: "Customer Success Manager",
        does: "Looks after a set of existing customers so they keep using your product, renew and buy more.",
        tasks: [
          "Run onboarding calls and 30, 60 and 90-day check-ins",
          "Watch usage and contact at-risk accounts before renewal",
          "Track renewals early and pass upsell opportunities to sales",
        ],
        tools: "HubSpot, Salesforce, Gainsight or ChurnZero, Zoom",
      },
      {
        name: "Technical Support Specialist",
        does: "Answers software customers' \"how do I\" and \"it's broken\" tickets, reproduces bugs and hands clear reports to your developers.",
        tasks: [
          "Answer setup and how-to tickets with screenshots or short videos",
          "Reproduce bugs and log them in Jira with clear steps",
          "Keep help-center articles up to date for the most common questions",
        ],
        tools: "Intercom, Zendesk, Jira, Loom",
      },
      {
        name: "Helpdesk Support",
        does: "Fixes your employees' everyday IT problems remotely: passwords, laptops, email, printers and VPN.",
        tasks: [
          "Reset passwords and sort out sign-in and permission problems",
          "Fix Outlook, Teams and OneDrive problems by remote session",
          "Log every request in a ticket so nothing gets lost",
        ],
        tools: "Microsoft 365 or Google Workspace admin, ConnectWise or HaloPSA, NinjaOne",
      },
    ],
  },
  {
    id: "sales",
    category: "Sales & Lead Generation",
    title: "Sales and lead generation",
    intro: "People who find prospects and fill your calendar with qualified conversations.",
    roles: [
      {
        name: "Sales Representative",
        does: "Follows up with your leads, answers their questions and moves interested prospects toward a booked call.",
        tasks: [
          "Follow up new and stalled leads by phone and email",
          "Qualify prospects and book meetings on your calendar",
          "Keep every deal and note up to date in your CRM",
        ],
        tools: "HubSpot or Salesforce, Aircall, Gmail or Outlook",
      },
      {
        name: "Sales Development Representative (SDR)",
        does: "Finds and contacts target prospects by email, LinkedIn and phone, and books qualified meetings for whoever closes.",
        tasks: [
          "Build target lists that match your ideal customer",
          "Run email, LinkedIn and phone sequences, personalized for each prospect",
          "Qualify replies and book meetings on the closer's calendar",
        ],
        tools: "Apollo, LinkedIn Sales Navigator, HubSpot or Salesforce, Instantly or Outreach",
      },
      {
        name: "Lead Generation Specialist",
        does: "Builds and cleans the prospect lists your sales team works from. They research leads; they don't contact them.",
        tasks: [
          "Pull contacts that match your target customer from Apollo, Sales Navigator and directories",
          "Verify emails and remove bounces and duplicates",
          "Upload clean, tagged lists to your CRM",
        ],
        tools: "Apollo, LinkedIn Sales Navigator, Clay, NeverBounce or ZeroBounce",
      },
      {
        name: "Appointment Setter",
        does: "Calls your lead list from a script, checks whether each person is a fit and books appointments for you or your salesperson.",
        tasks: [
          "Call your lead list and ask the qualifying questions",
          "Call new web leads within minutes of them coming in",
          "Confirm booked appointments the day before to cut no-shows",
        ],
        tools: "GoHighLevel, Aircall or Kixie, Google Sheets",
      },
    ],
  },
  {
    id: "development",
    category: "Software Development & IT",
    title: "Software development and IT",
    intro: "Developers who build and maintain your software, and IT support for your team.",
    roles: [
      {
        name: "Software Developer",
        does: "Builds and maintains features in your software product, working in your codebase and your team's process.",
        tasks: [
          "Build features from tickets and open pull requests for review",
          "Fix bugs and add tests for the code they change",
          "Join stand-ups and estimate work with your team",
        ],
        tools: "GitHub or GitLab, Jira or Linear, your languages and frameworks",
      },
      {
        name: "Web Developer",
        does: "Builds and updates your website: new pages, layout changes, forms and integrations.",
        tasks: [
          "Build new pages and sections from designs",
          "Keep WordPress or Shopify themes and plugins updated and working",
          "Fix broken forms, layout bugs and slow pages",
        ],
        tools: "WordPress, Elementor, Shopify, HTML, CSS and JavaScript, Figma",
      },
      {
        name: "Full Stack Developer",
        does: "Works across the front end, back end and database of your web application.",
        tasks: [
          "Build features end to end, from the interface to the API and database",
          "Fix bugs anywhere in the app and add tests",
          "Help with deployments and monitoring",
        ],
        tools: "GitHub, React, Node.js or Python, Postgres, AWS or Vercel",
      },
      {
        name: "IT Support Specialist",
        does: "Looks after your team's laptops, accounts and software, so problems get fixed before they slow people down.",
        tasks: [
          "Set up and remove accounts, licenses and equipment when people join or leave",
          "Push updates and patches, and check backup alerts every morning",
          "Troubleshoot Microsoft 365 or Google Workspace problems",
        ],
        tools: "Microsoft 365 admin, Entra ID, Intune, NinjaOne",
      },
    ],
  },
  {
    id: "marketing",
    category: "Marketing & Digital",
    title: "Marketing",
    intro: "People who run your marketing channels and report on what they bring in.",
    roles: [
      {
        name: "Marketing Specialist",
        does: "Handles the day-to-day marketing work across your channels: content, email, social posts and reporting.",
        tasks: [
          "Keep the content calendar and publish on schedule",
          "Build and send email campaigns",
          "Report each week on traffic, leads and campaign results",
        ],
        tools: "Canva, Klaviyo or Mailchimp, Meta Business Suite, GA4",
      },
      {
        name: "Digital Marketing Manager",
        does: "Plans and runs your online campaigns, mainly paid ads, and reports on what each channel brings in.",
        tasks: [
          "Manage Google and Meta ad budgets, audiences and ad tests",
          "Check conversion tracking after every website change",
          "Report results against your cost-per-lead or return-on-ad-spend target",
        ],
        tools: "Google Ads, Meta Ads Manager, GA4, Google Tag Manager, Looker Studio",
      },
      {
        name: "Social Media Manager",
        does: "Plans, makes and posts your social content, and answers comments and messages.",
        tasks: [
          "Plan a monthly content calendar and get your sign-off",
          "Make posts and short videos in Canva and CapCut",
          "Reply to comments and messages daily and pass sales enquiries on",
        ],
        tools: "Canva, CapCut, Meta Business Suite, Later or Buffer",
      },
      {
        name: "SEO Specialist",
        does: "Improves where your business shows up in Google by fixing your site, improving pages and managing local listings.",
        tasks: [
          "Find and fix technical problems such as broken links and slow pages",
          "Write keyword briefs and improve titles and headings on existing pages",
          "Manage your Google Business Profile listings and review replies",
        ],
        tools: "Ahrefs or Semrush, Screaming Frog, Google Search Console, GA4",
      },
    ],
  },
  {
    id: "ecommerce",
    category: "E-commerce Operations",
    title: "E-commerce operations",
    intro: "People who keep your online store and marketplace listings running.",
    roles: [
      {
        name: "E-commerce Specialist",
        does: "Runs the day-to-day back end of your online store: products, collections, promotions and inventory.",
        tasks: [
          "Upload and update products, variants and images",
          "Set up discounts, bundles and sale banners, and take them down after",
          "Keep inventory counts in sync with your suppliers or warehouse",
        ],
        tools: "Shopify, Matrixify, Klaviyo, Google Sheets",
      },
      {
        name: "Shopify Support Specialist",
        does: "Looks after your Shopify store's pages, apps and theme settings, so it keeps working and selling.",
        tasks: [
          "Build collections, menus and landing pages in the theme editor",
          "Install and set up apps, and check they don't break the theme",
          "Fix product, checkout and display problems",
        ],
        tools: "Shopify admin, Judge.me or Okendo, Recharge, Klaviyo",
      },
      {
        name: "Amazon Operations Specialist",
        does: "Keeps your Amazon account healthy and your listings selling: listings, inventory, FBA shipments and account issues.",
        tasks: [
          "Write and improve listings, A+ Content and images",
          "Check Account Health daily and fix suppressed listings",
          "Plan FBA shipments and follow up Seller Support cases",
        ],
        tools: "Amazon Seller Central, Helium 10 or Jungle Scout, Keepa, SellerBoard",
      },
    ],
  },
  {
    id: "finance",
    category: "Finance & Accounting",
    title: "Finance and accounting",
    intro: "People who keep your books accurate and your bills and invoices moving.",
    roles: [
      {
        name: "Bookkeeper",
        does: "Keeps your books categorized, reconciled and ready for your accountant every month.",
        tasks: [
          "Categorize bank and card transactions in QuickBooks Online or Xero",
          "Reconcile bank, card and merchant accounts every month",
          "Close the month by an agreed date and send you the reports",
        ],
        tools: "QuickBooks Online, Xero, Dext or Hubdoc, Excel",
      },
      {
        name: "Accountant",
        does: "Handles the work above bookkeeping (accruals, reconciliations and financial statements) under your CPA or controller.",
        tasks: [
          "Prepare month-end accruals and schedules",
          "Reconcile every balance-sheet account, with support attached",
          "Prepare the month-end pack and the schedules for audit and tax",
        ],
        tools: "QuickBooks Online, Xero, NetSuite, Excel",
      },
      {
        name: "Accounts Payable / Receivable Specialist",
        does: "Gets your bills paid on time and your invoices sent and collected.",
        tasks: [
          "Enter and code vendor bills, and route them for approval",
          "Raise invoices promptly and check them before they go out",
          "Chase overdue accounts and apply incoming payments",
        ],
        tools: "Bill.com, QuickBooks Online, Xero, Stripe",
      },
    ],
  },
  {
    id: "creative",
    category: "Creative & Design",
    title: "Creative and design",
    intro: "People who make the visuals, video and writing your marketing runs on.",
    roles: [
      {
        name: "Graphic Designer",
        does: "Turns your marketing requests into finished ads, social posts, sales decks and print files, on brand and on deadline.",
        tasks: [
          "Produce ad creative in every size, with variations to test",
          "Design social posts, carousels and sales decks",
          "Keep your Canva brand kit and templates up to date",
        ],
        tools: "Canva Pro, Photoshop, Illustrator, Figma",
      },
      {
        name: "Video Editor",
        does: "Takes the raw footage you record and cuts it into finished Reels, TikToks, Shorts and YouTube videos.",
        tasks: [
          "Cut short clips with captions and hooks from your long recordings",
          "Edit YouTube videos: pacing, color, audio and end screens",
          "Make thumbnails and upload videos with titles and descriptions",
        ],
        tools: "Premiere Pro, DaVinci Resolve, CapCut, Descript",
      },
      {
        name: "UI/UX Designer",
        does: "Designs the screens and flows of your website or app so they are clear and easy to use.",
        tasks: [
          "Turn requirements into wireframes and clickable prototypes",
          "Design screens that follow your design system",
          "Hand designs to developers and review what gets built",
        ],
        tools: "Figma, FigJam, Hotjar",
      },
      {
        name: "Content Writer",
        does: "Writes the blog posts, service pages and emails that bring in search traffic and leads, in your business's voice.",
        tasks: [
          "Write blog posts and service pages from keyword briefs",
          "Upload and format posts in WordPress or Webflow",
          "Refresh older posts that have slipped in search results",
        ],
        tools: "WordPress, Webflow, Google Docs, SurferSEO, Grammarly",
      },
    ],
  },
];
