#!/usr/bin/env node
/** Discoverable command index. Keep in step with package.json scripts. */

const SECTIONS = [
  {
    title: "Verify",
    commands: [
      ["pnpm check", "the full gate: guardrails, typecheck, tests, build"],
      ["pnpm guardrails", "architecture and privacy guardrails only"],
      ["pnpm typecheck", "tsc across every workspace"],
      ["pnpm test", "unit and component tests"],
      ["pnpm test:e2e", "Playwright, phone and classroom layouts"],
      ["pnpm build", "production build of every workspace"]
    ]
  },
  {
    title: "Develop",
    commands: [
      ["pnpm dev", "player dev server — long-lived, run this yourself"],
      ["PLAYER_PORT=4273 pnpm test:e2e", "e2e on another port, beside a running dev server"]
    ]
  },
  {
    title: "Native shell on an Android emulator",
    commands: [
      ["pnpm mobile:start", "Metro for the shell — long-lived, run this yourself"],
      ["pnpm mobile:up", "boot the AVD, tunnel the ports, open the player"],
      ["pnpm mobile:lan", "both servers on the LAN for a phone — scan the QR"],
      ["pnpm mobile", "doctor: what is up, what is not, what to run"],
      ["pnpm mobile boot", "create and start the tablet AVD only"],
      ["pnpm mobile shot", "screenshot the emulator to a file"],
      ["pnpm mobile logs 30", "filtered logcat: JS and WebView errors"],
      ["pnpm mobile stop", "shut the emulator down"]
    ]
  },
  {
    title: "Guardrails (each runs standalone)",
    commands: [
      ["node scripts/check-engine-neutral.mjs", "invariant 2: contracts stay engine-neutral"],
      ["node scripts/check-progress-boundary.mjs", "invariant 2: templates never read progress"],
      ["node scripts/check-child-namespace.mjs", "one child's stars and regalos never become another's"],
      ["node scripts/check-firebase-boundary.mjs", "invariant 3: Firebase confined to its boundary"],
      ["node scripts/check-adult-gate.mjs", "invariant 4: the adult area stays behind its gate"],
      ["node scripts/check-strict-types.mjs", "no escapes from strict typing"],
      ["node scripts/check-privacy.mjs", "media provenance and no ad-hoc logging"]
    ]
  },
  {
    title: "Content (one-off)",
    commands: [
      ["node scripts/import-vocabulary-images.mjs", "re-import vocabulary pictures and their provenance"],
      ["node scripts/generate-synthetic-cast.mjs", "regenerate the synthetic class's avatars and silent audio"]
    ]
  }
];

const width = Math.max(
  ...SECTIONS.flatMap((section) => section.commands.map(([name]) => name.length))
);

for (const section of SECTIONS) {
  console.log(`\n${section.title}`);
  for (const [name, description] of section.commands) {
    console.log(`  ${name.padEnd(width)}  ${description}`);
  }
}
console.log("");
