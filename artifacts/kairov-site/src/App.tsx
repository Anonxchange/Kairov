import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { pageMetadata, type PageMetadata } from './seo';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function setMetaTag(
  documentNode: Document,
  attribute: 'name' | 'property',
  key: string,
  content: string,
) {
  let tag = documentNode.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!tag) {
    tag = documentNode.createElement('meta');
    tag.setAttribute(attribute, key);
    documentNode.head.appendChild(tag);
  }
  tag.content = content;
}

function applyMetadata(documentNode: Document, metadata: PageMetadata) {
  documentNode.title = metadata.title;
  setMetaTag(documentNode, 'name', 'description', metadata.description);
  setMetaTag(documentNode, 'property', 'og:site_name', 'Kairov');
  setMetaTag(documentNode, 'property', 'og:title', metadata.title);
  setMetaTag(documentNode, 'property', 'og:description', metadata.description);
  setMetaTag(documentNode, 'property', 'og:type', 'website');
  setMetaTag(documentNode, 'name', 'twitter:card', 'summary');
  setMetaTag(documentNode, 'name', 'twitter:title', metadata.title);
  setMetaTag(documentNode, 'name', 'twitter:description', metadata.description);

  documentNode.head
    .querySelectorAll(
      'meta[name="generator"], meta[property="og:image"], meta[name="twitter:image"], link[rel="preconnect"][href*="website-files.com"]',
    )
    .forEach((element) => element.remove());
}

function RouteMetadata() {
  const [location] = useLocation();
  const metadata = pageMetadata[location] ?? pageMetadata['/'];

  useEffect(() => {
    applyMetadata(document, metadata);
  }, [metadata]);

  return null;
}

const pageDocuments: Record<string, string> = {
  '/': 'home/001-index/index.html',
  '/about': 'about/001-about/index.html',
  '/services': 'services/001-services/index.html',
  '/case-studies-v1': 'cases/001-case-studies-v1/index.html',
  '/contact': 'contact/001-contact/index.html',
};

function applyPageOverrides(
  frame: HTMLIFrameElement,
  metadata: PageMetadata,
) {
  const page = frame.contentDocument;
  if (!page?.head || !page.body) return;

  applyMetadata(page, metadata);

  const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const routeUrl = (route: string) => `${appBase}${route}` || '/';

  const removeWebflowBranding = () => {
    page.querySelectorAll('.w-webflow-badge').forEach((badge) => badge.remove());
    page.querySelectorAll('.copyright-text-holder').forEach((attribution) => {
      if (/olynex|webflow/i.test(attribution.textContent ?? '')) {
        attribution.remove();
      }
    });
  };

  const badgeStyle = page.createElement('style');
  badgeStyle.textContent =
    '.w-webflow-badge, .copyright-text-holder { display: none !important; }';
  page.head.appendChild(badgeStyle);
  removeWebflowBranding();
  new MutationObserver(removeWebflowBranding).observe(page.documentElement, {
    childList: true,
    subtree: true,
  });

  page.querySelectorAll('.footer-grid').forEach((footerGrid) => {
    footerGrid
      .querySelectorAll<HTMLElement>('.footer-grid-content')
      .forEach((column) => {
        const heading = column
          .querySelector('.footer-heading')
          ?.textContent?.trim()
          .toLowerCase();
        if (heading === 'template') column.remove();
      });
  });

  const navRoutes: Record<string, string> = {
    home: '/',
    about: '/about',
    services: '/services',
    'case studies': '/case-studies-v1',
    contact: '/contact',
  };
  const nav = page.querySelector('.navbar-inner-menu');
  nav?.querySelectorAll('.nav-menu-dropdown').forEach((dropdown) => {
    const label =
      dropdown
        .querySelector('.navbar-dropdwn-toggle .nav-link')
        ?.textContent?.trim() ?? '';
    const route = navRoutes[label.toLowerCase()];

    if (label.toLowerCase() === 'pages') {
      dropdown.remove();
      return;
    }

    if (!route) return;

    const link = page.createElement('a');
    link.className = 'nav-link w-nav-link';
    link.textContent = label;
    link.href = routeUrl(route);
    link.target = '_top';
    dropdown.replaceWith(link);
  });

  nav?.querySelectorAll<HTMLAnchorElement>('a.nav-link.w-nav-link').forEach((link) => {
    const route = navRoutes[link.textContent?.trim().toLowerCase() ?? ''];
    if (!route) return;
    link.href = routeUrl(route);
    link.target = '_top';
  });

  const logo = page.querySelector<HTMLAnchorElement>('.navbar-logo-link');
  if (logo) {
    logo.href = routeUrl('/');
    logo.target = '_top';
  }

  page.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    const label = link.textContent?.trim().toLowerCase();
    if (label === 'start a project' || label === 'get in touch') {
      link.href = routeUrl('/contact');
      link.target = '_top';
    }
  });

  const walker = page.createTreeWalker(page.body, 4);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent;
    if (text) {
      node.textContent = text
        .replaceAll('[Add Kairov phone]', '+2348134478949')
        .replaceAll('[Add Kairov email]', 'support@kairov.com')
        .replaceAll('John Doe', 'Olamide Oluwole');
    }
    node = walker.nextNode();
  }

  page.querySelectorAll('a').forEach((link) => {
    if (link.textContent?.includes('+2348134478949')) {
      link.href = 'tel:+2348134478949';
    }
    if (link.textContent?.includes('support@kairov.com')) {
      link.href = 'mailto:support@kairov.com';
    }
  });

  page.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
    form.removeAttribute('data-turnstile-sitekey');
  });

  page.addEventListener(
    'submit',
    (event) => {
      const view = page.defaultView;
      const form = event.target;
      if (!view || !(form instanceof view.HTMLFormElement)) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const fields = Array.from(new FormData(form).entries())
        .filter(([, value]) => String(value).trim())
        .map(([name, value]) => `${name}: ${value}`)
        .join('\n');
      const formId = form.id.toLowerCase();
      const subject = formId.includes('phone-number')
        ? 'Request a call from Kairov'
        : formId.includes('email-form')
          ? 'Kairov email updates'
          : 'Website enquiry for Kairov';
      const mailto = `mailto:support@kairov.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fields)}`;

      view.location.assign(mailto);
    },
    true,
  );
}

function SourcePage({ path }: { path: string }) {
  const src = `${import.meta.env.BASE_URL}source/${pageDocuments[path]}`;
  return (
    <iframe
      key={path}
      className="source-page"
      src={src}
      title={`Kairov ${path === '/' ? 'home' : path.slice(1).replaceAll('-', ' ')}`}
      data-testid={`page-${path === '/' ? 'home' : path.slice(1)}`}
      onLoad={(event) =>
        applyPageOverrides(
          event.currentTarget,
          pageMetadata[path] ?? pageMetadata['/'],
        )
      }
    />
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={() => <SourcePage path="/" />} />
        <Route path="/about" component={() => <SourcePage path="/about" />} />
        <Route path="/services" component={() => <SourcePage path="/services" />} />
        <Route path="/case-studies-v1" component={() => <SourcePage path="/case-studies-v1" />} />
        <Route path="/contact" component={() => <SourcePage path="/contact" />} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RouteMetadata />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
