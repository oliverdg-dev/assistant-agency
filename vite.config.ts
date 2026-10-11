import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type {IncomingMessage, ServerResponse} from 'node:http';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {bookingConfigStatus, handleBookingHttp} from './api/_lib/bookingApi';
import {adminEnabled} from './api/_lib/adminApi';
import {devAdminHandler, devShortlistHandler} from './api/_lib/adminDev';
import {shortlistEnabled} from './api/_lib/shortlistApi';
import {devBookingDeps} from './api/_lib/bookingDev';
import {apiError, API_HEADERS, toApiRequest, writeApiResponse} from './api/_lib/http';
import {BRAND, isPlaceholderBrand} from './api/_lib/brand';

export default defineConfig(({mode}) => {
  // Loads .env.local etc. into process.env for the dev API middleware. Nothing
  // from process.env is passed to the browser bundle except VITE_* variables,
  // which Vite exposes itself.
  const env = loadEnv(mode, '.', '');
  Object.assign(process.env, env);
  warnOnMissingProductionConfig();
  guardPlaceholderBrand();

  return {
    plugins: [react(), tailwindcss(), brandHtmlPlugin(), bookingApiDevPlugin(), adminApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

// A production build without these still deploys, but leads would only reach
// the database or nowhere, so say so loudly in the build log.
function warnOnMissingProductionConfig() {
  if (process.env.VERCEL_ENV !== 'production') return;
  const missing = bookingConfigStatus();
  if (missing.length > 0) {
    console.warn(
      `\n⚠️  Production build is missing ${missing.join(', ')}. ` +
        'Job requests will not be saved or emailed until these are set in Vercel.\n',
    );
  }
}

// Production must not ship the placeholder brand or example.com mailboxes.
// Set ALLOW_PLACEHOLDER_BRAND=1 to deploy anyway (for a private staging site).
function guardPlaceholderBrand() {
  if (process.env.VERCEL_ENV !== 'production' || !isPlaceholderBrand()) return;
  if (process.env.ALLOW_PLACEHOLDER_BRAND === '1') {
    console.warn(
      '\n⚠️  Deploying to production with the placeholder brand (ALLOW_PLACEHOLDER_BRAND=1).\n',
    );
    return;
  }
  throw new Error(
    'Set the real brand in api/_lib/brand.ts before a production deploy ' +
      '(or set ALLOW_PLACEHOLDER_BRAND=1 to override).',
  );
}

// Fills the brand into index.html so api/_lib/brand.ts is the only place it's set.
function brandHtmlPlugin(): Plugin {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return {
    name: 'brand-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('__BRAND_NAME__', escape(BRAND.name))
        .replaceAll('__BRAND_CONTACT_EMAIL__', escape(BRAND.contactEmail));
    },
  };
}

// Serves POST /api/booking during `npm run dev` through the same handler the
// Vercel function uses.
function bookingApiDevPlugin(): Plugin {
  return {
    name: 'booking-api-dev-plugin',
    configureServer(server) {
      const deps = devBookingDeps();

      server.middlewares.use(
        '/api/booking',
        async (req: IncomingMessage, res: ServerResponse) => {
          const body = await readBody(req);
          const result = await handleBookingHttp({method: req.method, body}, deps);
          res.statusCode = result.status;
          for (const [name, value] of Object.entries(result.headers ?? {})) {
            res.setHeader(name, value);
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        },
      );
    },
  };
}

// Serves /api/admin/* and /api/shortlist/* during `npm run dev` through the
// same routes as api/admin.ts and api/shortlist.ts. FEATURE_ADMIN=0 or
// FEATURE_SHORTLIST=0 switches an area off to match production.
function adminApiDevPlugin(): Plugin {
  return {
    name: 'admin-api-dev-plugin',
    configureServer(server) {
      const areas = [
        {mount: '/api/admin', handle: devAdminHandler(), enabled: process.env.FEATURE_ADMIN !== '0' && adminEnabled()},
        {mount: '/api/shortlist', handle: devShortlistHandler(), enabled: process.env.FEATURE_SHORTLIST !== '0' && shortlistEnabled()},
      ];

      for (const area of areas) {
        server.middlewares.use(area.mount, async (req: IncomingMessage, res: ServerResponse) => {
          if (!area.enabled) {
            return writeApiResponse(res, {...apiError(404, 'not_found', 'Not found.'), headers: API_HEADERS});
          }
          const request = await toApiRequest(req, 'url');
          if ('status' in request) {
            return writeApiResponse(res, {...request, headers: API_HEADERS});
          }
          writeApiResponse(res, await area.handle(request));
        });
      }
    },
  };
}

// Returns the raw body text; handleBookingHttp parses it and answers 400 for
// malformed JSON.
async function readBody(req: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length === 0 ? undefined : Buffer.concat(chunks).toString('utf8');
}
