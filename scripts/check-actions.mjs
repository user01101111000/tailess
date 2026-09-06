/**
 * Every `with:` key in a workflow must be an input the action actually declares.
 *
 * A GitHub action that receives an input it does not declare emits a *warning*, not an
 * error, so the step runs on with that value silently dropped. That is how a Dependabot
 * major bump broke the release: `changesets/action` v2 renamed `publish` to
 * `publish-script` and `version` to `version-script`, the workflow kept passing the v1
 * names, CI stayed green — nothing here runs the release — and the publish step failed
 * with no publish script at all. Actions are pinned by SHA precisely so they cannot move
 * underneath us; this checks that when we move one deliberately, we move its inputs too.
 *
 * Run in CI, where the network is a given. It resolves each action at the exact ref the
 * workflow pins, so it describes what will really run rather than what `main` declares
 * today.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const dir = fileURLToPath(new URL("../.github/workflows/", import.meta.url));
const problems = [];
const checked = [];

/** The `action.yml` an `owner/repo@ref` — or `owner/repo/sub/path@ref` — resolves to. */
async function actionInputs(uses) {
  const at = uses.lastIndexOf("@");
  const ref = uses.slice(at + 1);
  const [owner, repo, ...sub] = uses.slice(0, at).split("/");
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${sub.join("/")}`;
  for (const name of ["action.yml", "action.yaml"]) {
    const url = sub.length > 0 ? `${base}/${name}` : `${base}${name}`;
    const response = await fetch(url);
    if (!response.ok) continue;
    const doc = load(await response.text());
    return Object.keys(doc?.inputs ?? {});
  }
  return null;
}

for (const file of await readdir(dir)) {
  if (!/\.ya?ml$/.test(file)) continue;
  const doc = load(await readFile(join(dir, file), "utf8"));
  for (const [job, config] of Object.entries(doc?.jobs ?? {})) {
    for (const step of config.steps ?? []) {
      // A local reusable workflow has no inputs of this kind, and no URL to fetch.
      if (!step.uses || step.uses.startsWith("./")) continue;
      const given = Object.keys(step.with ?? {});
      if (given.length === 0) continue;

      const declared = await actionInputs(step.uses);
      if (declared === null) {
        problems.push(`${file} / ${job}: could not read the action definition for ${step.uses}`);
        continue;
      }
      const unknown = given.filter((key) => !declared.includes(key));
      if (unknown.length > 0) {
        problems.push(
          `${file} / ${job} / "${step.name ?? step.uses}"\n` +
            `  passes ${unknown.map((k) => `\`${k}\``).join(", ")}, which ${step.uses} does not declare.\n` +
            `  It accepts: ${declared.join(", ")}`,
        );
        continue;
      }
      checked.push(`${step.uses} — ${given.length} input${given.length === 1 ? "" : "s"}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\n[tailess] workflow inputs do not match the actions they are given to:\n`);
  for (const problem of problems) console.error(`${problem}\n`);
  process.exit(1);
}

console.log(`[tailess] every workflow input is declared by the action it goes to:`);
for (const line of [...new Set(checked)]) console.log(`  ${line}`);
