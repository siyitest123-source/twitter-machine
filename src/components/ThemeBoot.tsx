/**
 * ThemeBoot — synchronous theme bootstrap.
 *
 * Renders a tiny inline <script> in the document <head> that runs BEFORE
 * paint, reading the persisted theme from localStorage and stamping
 * data-theme / data-accent / data-density on <html>. This prevents a
 * light/dark flicker on first paint.
 *
 * Render once, in app/layout.tsx, anywhere in the tree — but ideally
 * inside <head> so it runs first. In Next 14+/15+ you can just drop it
 * inside <body>; it still runs before React hydrates.
 */
export function ThemeBoot() {
  const code = `
(function() {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem('tf-theme') || 'light';
    d.dataset.theme = t;
    d.dataset.accent = localStorage.getItem('tf-accent') || 'blue';
    d.dataset.density = localStorage.getItem('tf-density') || 'comfy';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.accent = 'blue';
    document.documentElement.dataset.density = 'comfy';
  }
})();
`.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
