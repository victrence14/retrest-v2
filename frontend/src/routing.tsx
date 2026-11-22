import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export const routes = {
  login: '/login',
  signup: '/signup',
  recovery: '/recovery',
  resetPassword: '/reset-password',
  preview: '/preview',
  deviceBinding: '/device-binding',
  shield: '/shield',
  subscriptions: '/subscriptions',
  wallets: '/wallets',
  card: '/card',
  account: '/account',
} as const;

const protectedPaths = new Set<string>([
  routes.shield,
  routes.subscriptions,
  routes.wallets,
  routes.card,
  routes.account,
  routes.deviceBinding,
]);

const publicPaths = new Set<string>([
  routes.login,
  routes.signup,
  routes.recovery,
  routes.resetPassword,
  routes.preview,
]);

export type RouteMatch =
  | { kind: 'protected'; pathname: string }
  | { kind: 'public'; pathname: string }
  | { kind: 'not-found'; pathname: string };

export function matchRoute(pathname: string): RouteMatch {
  if (protectedPaths.has(pathname)) return { kind: 'protected', pathname };
  if (publicPaths.has(pathname)) return { kind: 'public', pathname };
  return { kind: 'not-found', pathname };
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return routes.shield;
  }

  try {
    const url = new URL(value, 'https://retrest.invalid');
    if (url.origin !== 'https://retrest.invalid' || !protectedPaths.has(url.pathname)) {
      return routes.shield;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return routes.shield;
  }
}

function getLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function useCurrentLocation(): string {
  return useSyncExternalStore(subscribe, getLocation, () => routes.login);
}

export function navigateTo(destination: string, replace = false): void {
  const url = new URL(destination, window.location.origin);
  if (url.origin !== window.location.origin) {
    throw new Error('Navigation must stay within RETREST.');
  }
  const target = `${url.pathname}${url.search}${url.hash}`;
  if (replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  window.dispatchEvent(new Event('popstate'));
}

type AppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function AppLink({ href, onClick, target, ...props }: AppLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === '_blank'
    ) return;

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigateTo(`${url.pathname}${url.search}${url.hash}`);
  }

  return <a {...props} href={href} target={target} onClick={handleClick} />;
}
