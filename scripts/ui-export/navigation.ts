// Hooks are inert because renderToStaticMarkup never runs client interactions.
export function useRouter() {
  return { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
}
