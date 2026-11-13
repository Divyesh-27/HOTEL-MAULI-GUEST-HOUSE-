# Hotel Mauli Guest House desktop app (Electron + React + Vite)
- Desktop-only codebase. No mobile code here.
- Don't redesign UI, colours, fonts or navigation. Use existing theme
  tokens and components.
- Migrations are additive only. Never delete or rewrite existing data.
  Back up the DB before schema changes.
- Dates: use the dateUtils local-date helpers, never toISOString.
  Show DD-MM-YYYY.
- Number fields use NumberInput. Typing, clearing, decimals and paste
  must work.
- Billing, GST, history, salary and updater must keep working. Don't
  touch them unless the task says so.
- Paid slips and past bills are never changed silently. Corrections
  create an adjustment plus an audit entry.
- Secrets: never read, print or commit .env, tokens or keys. No
  service_role key anywhere.
- Never merge, push, bump the version, build the installer or publish
  unless asked. I publish releases myself.
- Read the relevant files and report in a few lines before coding.
- Finish with npx tsc --noEmit and npm run build. Say plainly what you
  did not run or test. Don't claim something works unless you ran it.
