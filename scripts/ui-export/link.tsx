import type { ComponentProps } from 'react';

// Static snapshots use local HTML links instead of Next's runtime router.
const routes: Record<string, string> = {
  '/': 'landing', '/shield': 'shield', '/pools': 'pools', '/insights': 'insights',
  '/transactions': 'transactions', '/settings': 'settings', '/support': 'support',
  '/login': 'login', '/signup': 'signup', '/forgot-password': 'forgot-password',
  '/reset-password': 'reset-password', '/device-binding': 'device-binding',
};

export default function Link({ href, children, prefetch: _prefetch, scroll: _scroll, replace: _replace, ...props }: ComponentProps<'a'> & {
  href: string; prefetch?: boolean; scroll?: boolean; replace?: boolean;
}) {
  const path = href.split(/[?#]/)[0] ?? href;
  const destination = routes[path] ? `${routes[path]}.html` : href.startsWith('/') ? '#' : href;
  return <a {...props} href={destination}>{children}</a>;
}
