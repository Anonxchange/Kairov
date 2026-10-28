import path from 'path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { pageMetadata } from './src/seo';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

function setHtmlMeta(
  html: string,
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  const matcher = new RegExp(
    `<meta\\b(?=[^>]*\\b${attribute}="${key}")[^>]*>`,
    'i',
  );
  const tag = `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(content)}">`;
  return matcher.test(html)
    ? html.replace(matcher, tag)
    : html.replace(/<\/head>/i, `${tag}</head>`);
}

function withPageMetadata(
  html: string,
  metadata: (typeof pageMetadata)[string],
) {
  let result = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlAttribute(metadata.title)}</title>`,
  );

  const tags = [
    ['name', 'description', metadata.description],
    ['property', 'og:site_name', 'Kairov'],
    ['property', 'og:title', metadata.title],
    ['property', 'og:description', metadata.description],
    ['property', 'og:type', 'website'],
    ['name', 'twitter:card', 'summary'],
    ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description],
  ] as const;

  for (const [attribute, key, content] of tags) {
    result = setHtmlMeta(result, attribute, key, content);
  }

  return result;
}

const sourcePageMetadata: Record<string, (typeof pageMetadata)[string]> = {
  'source/home/001-index/index.html': pageMetadata['/'],
  'source/about/001-about/index.html': pageMetadata['/about'],
  'source/services/001-services/index.html': pageMetadata['/services'],
  'source/cases/001-case-studies-v1/index.html':
    pageMetadata['/case-studies-v1'],
  'source/contact/001-contact/index.html': pageMetadata['/contact'],
};

function stripWebflowExportBranding(
  html: string,
  metadata: (typeof pageMetadata)[string],
) {
  const cleanHtml = html
    .replace(/<!--[^>]*\bWebflow\b[^>]*-->/gi, '')
    .replace(/\sdata-wf-[\w-]+="[^"]*"/gi, '')
    .replace(/\sdata-turnstile-sitekey="[^"]*"/gi, '')
    .replace(/<meta\b(?=[^>]*\bname="generator")[^>]*>\s*/gi, '')
    .replace(
      /<meta\b(?=[^>]*\b(?:property="og:image"|name="twitter:image"))[^>]*>\s*/gi,
      '',
    )
    .replace(
      /<link\b(?=[^>]*\bhref="https?:\/\/cdn\.prod\.website-files\.com\/?")[^>]*>\s*/gi,
      '',
    )
    .replace(
      /<link\b(?=[^>]*\brel="(?:shortcut icon|apple-touch-icon)")[^>]*>\s*/gi,
      '',
    )
    .replace(
      /fs-components-src="https:\/\/cdn\.prod\.website-files\.com\/[^"]*finsweetcomponentsconfig-1\.0\.0\.js"/gi,
      'fs-components-src="assets/js/cdn.prod.website-files.com/68ea19d96471e04cf1b2fd0c_2F6544eda5f000985a163a8687_2F68eb703a87a6c159aba21b58_2Ffinsweetcomponentsconfig-1.0.0.js"',
    )
    .replace(
      /<script\b(?=[^>]*\bsrc="assets\/js\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js")[^>]*>\s*<\/script>\s*/gi,
      '',
    )
    .replace(
      /<div class="copyright-text-holder">[\s\S]*?<\/div>\s*<\/div>/gi,
      '',
    )
    .replace(
      /<\/head>/i,
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2"><style id="kairov-branding-suppression">.w-webflow-badge,.w-webflow-badge *,.copyright-text-holder{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}</style></head>',
    );

  return withPageMetadata(cleanHtml, metadata);
}

function stripWebflowBadgeInjection(script: string) {
  const badgeInitializer =
    /a\.ready=function\(\)\{var a,n,d,u=l\.attr\("data-wf-status"[\s\S]*?\},a\}\)\},322:function/;
  if (!badgeInitializer.test(script)) {
    throw new Error(
      'Could not locate the exported Webflow badge initializer to disable it.',
    );
  }
  return script.replace(
    badgeInitializer,
    'a.ready=function(){},a})},322:function',
  );
}

let buildOutputDirectory = '';

const routeMetadataPlugin: Plugin = {
  name: 'kairov-route-metadata',
  apply: 'build',
  enforce: 'post',
  configResolved(config) {
    buildOutputDirectory = config.build.outDir;
  },
  generateBundle(_options, bundle) {
    const index = bundle['index.html'];
    if (!index || index.type !== 'asset') return;

    const shell =
      typeof index.source === 'string'
        ? index.source
        : new TextDecoder().decode(index.source);

    for (const [route, metadata] of Object.entries(pageMetadata)) {
      if (route === '/') continue;
      const fileName = `${route.slice(1)}/index.html`;
      bundle[fileName] = {
        type: 'asset',
        fileName,
        source: withPageMetadata(shell, metadata),
      };
    }
  },
  async closeBundle() {
    const sourceDirectory = path.join(buildOutputDirectory, 'source');
    async function sanitizeDirectory(directory: string): Promise<void> {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await sanitizeDirectory(filePath);
          continue;
        }

        const relativePath = path
          .relative(buildOutputDirectory, filePath)
          .split(path.sep)
          .join('/');
        const metadata = sourcePageMetadata[relativePath];
        if (metadata && entry.name === 'index.html') {
          const html = await readFile(filePath, 'utf8');
          await writeFile(filePath, stripWebflowExportBranding(html, metadata));
          continue;
        }

        if (
          relativePath.startsWith('source/') &&
          entry.name === 'webflow.schunk.dbc8f13913b95965.js'
        ) {
          const script = await readFile(filePath, 'utf8');
          await writeFile(filePath, stripWebflowBadgeInjection(script));
        }
      }
    }

    await sanitizeDirectory(sourceDirectory);
  },
};

const sourcePageHtmlPlugin: Plugin = {
  name: 'kairov-source-page-branding-cleanup',
  apply: 'serve',
  enforce: 'pre',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const relativePath = decodeURIComponent(pathname.replace(/^\/+/, ''));
      const metadata = sourcePageMetadata[relativePath];
      const isWebflowBadgeScript =
        relativePath.startsWith('source/') &&
        relativePath.endsWith('/webflow.schunk.dbc8f13913b95965.js');
      if ((!metadata && !isWebflowBadgeScript) || !server.config.publicDir) {
        next();
        return;
      }

      const publicRoot = path.resolve(server.config.publicDir);
      const filePath = path.resolve(publicRoot, relativePath);
      if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
        next();
        return;
      }

      try {
        const source = await readFile(filePath, 'utf8');
        response.statusCode = 200;
        response.setHeader('Cache-Control', 'no-store');
        if (metadata) {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(stripWebflowExportBranding(source, metadata));
        } else {
          response.setHeader(
            'Content-Type',
            'application/javascript; charset=utf-8',
          );
          response.end(stripWebflowBadgeInjection(source));
        }
      } catch {
        next();
      }
    });
  },
};

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    routeMetadataPlugin,
    sourcePageHtmlPlugin,
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
