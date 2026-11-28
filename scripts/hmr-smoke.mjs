/**
 * Proves the stylesheet follows the source while a dev server runs — the half of the
 * integration no production build exercises.
 *
 * A build scans the source once. A dev server has to keep doing it: a save that adds a
 * runtime-built class has to rewrite the class list and get Tailwind to rebuild, and a save
 * that removes one has to take its rule away again. That rests on how Tailwind's compiler
 * caches its `@source inline(...)` list, which is no documented contract, so a Tailwind,
 * Vite or Next release can break it while every build stays green.
 *
 * Run it from the app's directory, with the dev server's command after `--`:
 *
 *   node hmr-smoke.mjs --url http://127.0.0.1:5180/ --css src/app.css \
 *     --expect md:space-y-8 --edit src/App.styles.ts --new-file src/HmrProbe.ts \
 *     -- node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort
 *
 *   --url       the page, which is also how the probe knows the server is up. An address,
 *               not `localhost`, so the probe and the server cannot resolve it differently.
 *   --css       the stylesheet to read, relative to `--url`. Without it, every
 *               `<link rel="stylesheet">` in the page is read, which is how Next serves one.
 *               No leading slash: Git Bash rewrites `/src/app.css` into a Windows path
 *               before Node sees it, so a replay of the CI step there would probe nothing.
 *   --expect    a class the app already builds at runtime. It has to be served before
 *               anything else is checked, and still be served whenever a rule is checked
 *               for being gone — otherwise reading the wrong stylesheet, or a half-built
 *               one, would pass every "gone" check by never having held the rule at all.
 *   --edit      a file that already imports `ss` from "tailess"; a call is appended to it.
 *   --new-file  a path nothing uses; a file is written there that nothing imports.
 *   --startup-timeout  seconds to wait for the server and `--expect` (default 180). A cold
 *               first compile is slow: Turbopack took over a minute on a Windows laptop.
 *   --timeout   seconds to wait at each step after that (default 60). A working server
 *               takes about a second, so this only decides how long a broken one costs.
 *
 * Once `--expect` is served, and with the server left alone for a moment before each change:
 *   1. append `void ss({ md: "<fresh>" })` to `--edit`  → its rule is served;
 *   2. restore the file                                → the rule is gone;
 *   3. write `--new-file` with another fresh class     → its rule is served;
 *   4. delete the file                                 → the rule is gone.
 *
 * Each fresh class is a new arbitrary value, so nothing an earlier run left in a cache can
 * answer for it. The edited file is restored and the server stopped however the run ends.
 * Exit 0 when every step passed, 1 when one did not, 2 when nothing could be checked.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const usage =
  "usage: node hmr-smoke.mjs --url <url> [--css <path>] --expect <class> --edit <file> " +
  "--new-file <file> [--startup-timeout <seconds>] [--timeout <seconds>] -- <command...>";

/** Exits 2: the probe was set up wrong, so it has proved nothing either way. */
function unusable(message) {
  console.error(`::error::${message}`);
  process.exit(2);
}

function parse(argv) {
  const split = argv.indexOf("--");
  const own = split === -1 ? argv : argv.slice(0, split);
  const command = split === -1 ? [] : argv.slice(split + 1);
  const flags = {};
  for (let i = 0; i < own.length; i += 2) {
    if (!own[i].startsWith("--") || own[i + 1] === undefined) {
      unusable(`cannot read "${own[i]}"\n${usage}`);
    }
    flags[own[i].slice(2)] = own[i + 1];
  }
  for (const name of ["url", "expect", "edit", "new-file"]) {
    if (!flags[name]) unusable(`--${name} is required\n${usage}`);
  }
  if (command.length === 0) unusable(`no dev server command after "--"\n${usage}`);
  return {
    url: flags.url,
    css: flags.css,
    expect: flags.expect,
    edit: flags.edit,
    newFile: flags["new-file"],
    startupTimeout: seconds(flags["startup-timeout"] ?? "180"),
    timeout: seconds(flags.timeout ?? "60"),
    command,
  };
}

function seconds(value) {
  const n = Number(value);
  if (!(n > 0)) unusable(`"${value}" is not a number of seconds`);
  return n * 1000;
}

/** How Tailwind escapes a class name inside a selector — as `verify.mjs` in CI does. */
function selectorFor(cls) {
  return `.${[...cls].map((ch) => (/[a-zA-Z0-9_-]/.test(ch) ? ch : `\\${ch}`)).join("")}`;
}

/**
 * Whether `text` holds a rule for `cls`. Vite serves a stylesheet that a module imports as
 * JavaScript, with the CSS inside a JSON string where every backslash of the escaping is
 * doubled, so both spellings count.
 */
function hasRule(text, cls) {
  const selector = selectorFor(cls);
  return text.includes(selector) || text.includes(JSON.stringify(selector).slice(1, -1));
}

async function get(url) {
  let response;
  try {
    response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  } catch (error) {
    // `fetch failed` alone names nothing; the reason — ECONNREFUSED, a reset — is the cause.
    const cause = error.cause?.code ?? error.cause?.message ?? error.message;
    throw new Error(`GET ${url} failed: ${cause}`);
  }
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
  return response.text();
}

/** The stylesheet the page is served with right now. */
async function stylesheet({ url, css }) {
  if (css) return get(new URL(css, url));
  const html = await get(url);
  const hrefs = [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1]?.replaceAll("&amp;", "&"))
    .filter(Boolean);
  if (hrefs.length === 0) throw new Error(`the page at ${url} links no stylesheet`);
  const sheets = await Promise.all(hrefs.map((href) => get(new URL(href, url))));
  return sheets.join("\n");
}

async function answers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

function start(command) {
  const [bin, ...args] = command;
  const child = spawn(bin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    // A process group of its own, so stopping it stops what it started: `next dev` serves
    // from a child process, which a signal to its parent alone leaves holding the port.
    detached: process.platform !== "win32",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const server = { child, exited: null, tail: [] };
  const keep = (chunk) => {
    const lines = chunk.toString().split(/\r?\n/);
    server.tail.push(...lines.filter((line) => line.trim() !== ""));
    server.tail.splice(0, Math.max(0, server.tail.length - 80));
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  child.on("error", (error) => {
    server.exited ??= error.message;
  });
  child.on("exit", (code, signal) => {
    server.exited ??= signal ?? `exit code ${code}`;
  });
  return server;
}

async function stop(server) {
  const { pid } = server.child;
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {}
  }
  for (let waited = 0; server.exited === null && waited < 10_000; waited += 100) {
    await sleep(100);
  }
  if (process.platform !== "win32") {
    // Whatever in the group outlived the parent; ESRCH just means nothing did.
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
  }
}

/** Polls the stylesheet until `test` passes, or throws once `timeout` ms have passed. */
async function waitFor(what, test, timeout, server) {
  const started = Date.now();
  let failed = null;
  while (Date.now() - started < timeout) {
    if (server.exited !== null) {
      throw new Error(`the dev server stopped (${server.exited}) while waiting for ${what}`);
    }
    try {
      if (test(await stylesheet(options))) {
        console.log(`ok  ${what} (${Date.now() - started} ms)`);
        return;
      }
      failed = null;
    } catch (error) {
      failed = error;
    }
    await sleep(500);
  }
  const why = failed ? `; the last request failed: ${failed.message}` : "";
  throw new Error(`timed out after ${timeout / 1000}s waiting for ${what}${why}`);
}

/**
 * How long the server is left alone before each change. A step passes the moment its rule
 * is served or gone, which can be while work that step set off is still running — a
 * debounced rescan, a rebuild — and that work can pick up the *next* change by accident.
 * A new file in a monorepo package outside Vite's root was "seen" that way while nothing
 * watched the package, so the probe passed or failed by timing. Waiting it out makes every
 * step answer for itself.
 */
const quiet = 2000;

const used = new Set();

/** A utility no file holds yet: a fresh arbitrary value every time. */
function fresh() {
  let utility = "";
  while (utility === "" || used.has(utility)) {
    utility = `indent-[${100 + Math.floor(Math.random() * 900)}px]`;
  }
  used.add(utility);
  return utility;
}

const options = parse(process.argv.slice(2));
const original = readFileSync(options.edit, "utf8");
if (!/import\s*\{[^}]*\bss\b[^}]*\}\s*from\s*["']tailess["']/.test(original)) {
  unusable(`${options.edit} does not import ss from "tailess", and a call to it is appended`);
}
if (existsSync(options.newFile)) {
  unusable(`${options.newFile} exists; --new-file has to be a path nothing uses`);
}
if (await answers(options.url)) {
  unusable(`something already answers at ${options.url}, and it would be probed instead`);
}

console.log(`$ ${options.command.join(" ")}`);
const server = start(options.command);
const served = (cls) => (css) => hasRule(css, cls);
const gone = (cls) => (css) => hasRule(css, options.expect) && !hasRule(css, cls);
let restore = false;
let remove = false;

try {
  const { startupTimeout, timeout } = options;
  await waitFor(`${options.expect} at startup`, served(options.expect), startupTimeout, server);

  const edited = `md:${fresh()}`;
  if (hasRule(await stylesheet(options), edited)) {
    throw new Error(`${edited} is served before any file holds it`);
  }
  await sleep(quiet);
  restore = true;
  writeFileSync(options.edit, `${original}\nvoid ss({ md: "${edited.slice(3)}" });\n`);
  await waitFor(`${edited} after an edit adds it`, served(edited), timeout, server);
  await sleep(quiet);
  writeFileSync(options.edit, original);
  restore = false;
  await waitFor(`${edited} gone once the edit is undone`, gone(edited), timeout, server);

  const created = `md:${fresh()}`;
  await sleep(quiet);
  remove = true;
  writeFileSync(
    options.newFile,
    `import { ss } from "tailess";\n\nexport const probe = ss({ md: "${created.slice(3)}" });\n`,
  );
  await waitFor(`${created} from a file nothing imports`, served(created), timeout, server);
  await sleep(quiet);
  rmSync(options.newFile);
  remove = false;
  await waitFor(`${created} gone with the file`, gone(created), timeout, server);

  console.log("the stylesheet followed every change");
} catch (error) {
  console.error(`::error::${error.message}`);
  console.error(`--- the dev server's last ${server.tail.length} lines ---`);
  console.error(server.tail.join("\n"));
  process.exitCode = 1;
} finally {
  if (restore) writeFileSync(options.edit, original);
  if (remove) rmSync(options.newFile, { force: true });
  await stop(server);
}
