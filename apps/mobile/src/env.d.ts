/**
 * Expo's Babel transform inlines `EXPO_PUBLIC_*` variables at build time, and it
 * only recognises **dot access** on `process.env`. Declaring the variable here
 * is what keeps that dot access legal under
 * `noPropertyAccessFromIndexSignature`, which would otherwise force bracket
 * syntax the transform cannot see — and a variable it cannot see is a variable
 * that is `undefined` on the device while working perfectly in a test.
 */
declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_PLAYER_URL?: string;
  };
};
