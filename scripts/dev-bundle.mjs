// Prints one self-contained script that runs the content scripts on a live
// page without installing the extension: paste it into the page's DevTools
// console (or run it from a browser automation tool). Running it again
// replaces the previous run.
//
//   node scripts/dev-bundle.mjs                      # default settings
//   node scripts/dev-bundle.mjs '{"paused":false,…}' # a custom `effective`
//
// In the page afterwards:
//   HM.report(HM.current.site)           which selectors match, -1 = invalid
//   HM.devHide({ views: false })         flip switches live
//   HM.devSet(effective)                 replace the whole `effective`
//
// The output is for local use only; don't commit it.
import fs from 'node:fs';
import '../src/core/schedule.js';
import '../src/core/state.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root), 'utf8'));
const files = manifest.content_scripts[0].js;
const HM = globalThis.HM;
const effective = process.argv[2] ? JSON.parse(process.argv[2]) : HM.computeEffective(HM.defaultState(), Date.now());

const parts = files.map((f) => `// ---- ${f}\n${fs.readFileSync(new URL(f, root), 'utf8')}`);

process.stdout.write(`(function () {
  if (globalThis.HM && globalThis.HM.cleanup) globalThis.HM.cleanup.forEach((fn) => fn());
  globalThis.HM = {};
  const listeners = [];
  let effective = ${JSON.stringify(effective)};
  const chrome = {
    storage: {
      local: { get: async () => ({ effective: structuredClone(effective) }) },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };
  globalThis.HM.devSet = (next) => {
    const oldValue = effective;
    effective = next;
    listeners.forEach((fn) => fn({ effective: { oldValue, newValue: next } }, 'local'));
  };
  globalThis.HM.devHide = (patch) => globalThis.HM.devSet({ ...effective, hide: { ...effective.hide, ...patch } });
${parts.join('\n')}
})();
`);
