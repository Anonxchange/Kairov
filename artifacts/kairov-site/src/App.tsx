import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

const pageDocuments: Record<string, string> = {
  '/': 'home/001-index/index.html',
  '/about': 'about/001-about/index.html',
  '/services': 'services/001-services/index.html',
  '/case-studies-v1': 'cases/001-case-studies-v1/index.html',
  '/contact': 'contact/001-contact/index.html',
};

function applyPageOverrides(frame: HTMLIFrameElement) {
  const page = frame.contentDocument;
  if (!page?.head || !page.body) return;

  const badgeStyle = page.createElement('style');
  badgeStyle.textContent = '.w-webflow-badge { display: none !important; }';
  page.head.appendChild(badgeStyle);

  const walker = page.createTreeWalker(page.body, 4);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent;
    if (text?.includes('[Add Kairov phone]')) {
      node.textContent = text.replaceAll(
        '[Add Kairov phone]',
        '+2348134478949',
      );
    }
    node = walker.nextNode();
  }

  page.querySelectorAll('a').forEach((link) => {
    if (link.textContent?.includes('+2348134478949')) {
      link.href = 'tel:+2348134478949';
    }
  });
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
      onLoad={(event) => applyPageOverrides(event.currentTarget)}
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
