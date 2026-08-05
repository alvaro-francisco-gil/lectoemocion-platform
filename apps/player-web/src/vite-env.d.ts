/// <reference types="vite/client" />

/**
 * Declaring the flag here is what makes the bypass eliminable.
 *
 * Vite replaces `import.meta.env.VITE_X` statically only through property
 * access; `import.meta.env["VITE_X"]` survives into the bundle as a runtime
 * lookup. `noPropertyAccessFromIndexSignature` forbids property access on an
 * index signature, so without this declaration the only type-legal form is the
 * one that defeats the elimination.
 *
 * `e2e/bypass.spec.ts` asserts the flag name is absent from `dist/`.
 */
interface ImportMetaEnv {
  readonly VITE_LECTOEMOCION_UNLOCK_ALL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
