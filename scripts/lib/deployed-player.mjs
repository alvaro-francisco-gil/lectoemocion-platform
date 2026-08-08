/**
 * Pure logic for checking a deployed player, so the rules can be tested
 * without a network.
 *
 * These exist because the caching in `firebase.json` is a release criterion
 * rather than an optimisation — [ADR 0009](../../docs/decisions/0009-one-hosted-player.md)
 * makes offline launch depend on it — and because the first deploy shipped it
 * wrong in a way nothing could have caught. Firebase matches header globs
 * against the *request path*, and a visitor asks for `/`, which a
 * `/index.html` entry does not match. The page fell back to `max-age=3600`
 * while `/index.html` correctly said `no-cache`, so every hand check that
 * asked for the file passed and the URL a tester opens was stale for an hour.
 *
 * The HTTP requests live in `scripts/verify-deployment.mjs`.
 */

/** Where a Firebase project's default hosting site answers. */
export function siteUrl(firebasercJson) {
  const project = JSON.parse(firebasercJson)?.projects?.default;
  if (typeof project !== "string" || project.length === 0) {
    throw new Error("no projects.default in .firebaserc");
  }
  return `https://${project}.web.app`;
}

/**
 * The built assets a served page pulls in, as root-relative paths.
 *
 * Vite content-hashes these names, so they are also how a deploy is identified:
 * a page referencing a bundle that 404s means a partial upload.
 */
export function assetReferences(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
    (match) => match[1]
  );
}

/**
 * What `Cache-Control` a path must carry, or `null` where this does not care.
 *
 * The document must not be cached, so a tester reloading picks up a new build
 * rather than reporting bugs that are already fixed. Hashed assets must be
 * cached hard, because a new build gives them new names and nothing else keeps
 * a repeat launch off the network.
 */
export function cacheProblem(path, value) {
  const header = value ?? "";

  if (path === "/" || path === "/index.html") {
    return /no-cache|no-store|max-age=0/.test(header)
      ? null
      : `must not be cached, got "${header || "(absent)"}"`;
  }

  if (path.startsWith("/assets/")) {
    return header.includes("immutable")
      ? null
      : `must be immutable, got "${header || "(absent)"}"`;
  }

  return null;
}
