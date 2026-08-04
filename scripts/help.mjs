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
      ["pnpm dev", "player dev server — long-lived, run this yourself"]
    ]
  },
  {
    title: "Guardrails (each runs standalone)",
    commands: [
      ["node scripts/check-engine-neutral.mjs", "invariant 2: contracts stay engine-neutral"],
      ["node scripts/check-firebase-boundary.mjs", "invariant 3: Firebase confined to its boundary"],
      ["node scripts/check-strict-types.mjs", "no escapes from strict typing"],
      ["node scripts/check-privacy.mjs", "media provenance and no ad-hoc logging"]
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
