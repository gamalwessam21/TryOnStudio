import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

function loadServerEnvFiles() {
  for (const filename of ['.env.local', '.env']) {
    const fullPath = resolve(process.cwd(), filename);
    if (!existsSync(fullPath)) continue;
    const raw = readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

function localVercelApiPlugin(): Plugin {
  return {
    name: 'local-vercel-api-handlers',
    configureServer(server) {
      loadServerEnvFiles();

      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const urlPath = req.url?.split('?')[0] ?? '';
          if (
            urlPath !== '/api/assistant/chat' &&
            urlPath !== '/api/payments/stripe'
          ) {
            next();
            return;
          }

          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const rawBody = Buffer.concat(chunks);

            const host = req.headers.host || 'localhost:5173';
            const fullUrl = `http://${host}${req.url || urlPath}`;
            const headers = new Headers();
            for (const [k, v] of Object.entries(req.headers)) {
              if (Array.isArray(v)) {
                headers.set(k, v.join(', '));
              } else if (typeof v === 'string') {
                headers.set(k, v);
              }
            }

            const method = (req.method || 'GET').toUpperCase();
            const webReq = new Request(fullUrl, {
              method,
              headers,
              body:
                method !== 'GET' && method !== 'HEAD' && rawBody.length > 0
                  ? rawBody
                  : undefined,
            });

            const mod =
              urlPath === '/api/assistant/chat'
                ? await server.ssrLoadModule('/api/assistant/chat.ts')
                : await server.ssrLoadModule('/api/payments/stripe.ts');

            const handler = mod[method] as
              | ((request: Request) => Promise<Response>)
              | undefined;

            if (typeof handler !== 'function') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            const webRes = await handler(webReq);
            res.statusCode = webRes.status;
            webRes.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            const respBuf = Buffer.from(await webRes.arrayBuffer());
            res.end(respBuf);
          } catch (err) {
            console.error('[local-vercel-api]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({ error: 'Internal server error in local API handler.' })
            );
          }
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), localVercelApiPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mediapipe-vendor': ['@mediapipe/tasks-vision'],
          'decart-vendor': ['@decartai/sdk'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
