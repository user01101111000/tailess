import type { ContainerKey, ElementStateKey, MaxContainerKey } from "../constants.js";
import { isDev } from "../internal/env.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/** A container-query key, in either direction. */
export type AnyContainerKey = ContainerKey | MaxContainerKey;

/**
 * What a `group` or `peer` name may contain.
 *
 * These names only ever become part of a class name and of the selector Tailwind
 * escapes it into, so the alphabet is wide. One check covers every way one can fail,
 * because they all fail the same way — silently. An empty name, a `/`, or a `:`
 * produces no rule at all; a `.` produces one whose parent matcher reads as *two*
 * classes (`:where(.group\/a.b)` wants an element with both `group/a` and `b`);
 * whitespace splits the class in two.
 */
const validModifier = /^[\w-]+$/;

/**
 * What a `container` name may contain — strictly narrower than the above.
 *
 * A container name is not only part of the class: Tailwind also writes it into
 * `container-name:` and into the `@container` prelude, where CSS requires a
 * `<custom-ident>`. So a leading digit is out, and `2xl-panel`, `123` or a hex id
 * from `container(item.id, …)` all compile to CSS a browser then discards whole.
 */
const validIdent = /^(?:--|-?[A-Za-z_])[\w-]*$/;

/**
 * Words `@container` reads as syntax, plus the CSS-wide keywords a `<custom-ident>`
 * excludes. `not` is the worst of them: the prelude still parses, as an *unnamed*
 * negated query, so the rule applies to the nearest container with inverted logic
 * rather than doing nothing.
 */
const reservedNames = new Set([
  "none",
  "and",
  "or",
  "not",
  "initial",
  "inherit",
  "unset",
  "revert",
  "revert-layer",
  "default",
]);

/** Names already reported, so a warning in a render loop is printed once. */
const warnedNames = new Set<string>();

function warnBadName(helper: string, name: string): void {
  const seen = `${helper} ${name}`;
  if (warnedNames.has(seen)) return;
  warnedNames.add(seen);
  console.warn(
    `[tailess] ${helper}("${name}", …) — Tailwind generates no working rule for this ` +
      'name. Use letters, digits, "-" and "_"' +
      (helper === "container"
        ? ', starting with a letter or "_", and not a CSS keyword such as ' +
          '"none", "and", "or" or "not".'
        : "."),
  );
}

/** Build `prefix/name`, checking the name in development. */
function named(helper: string, name: string, prefix: string): string {
  if (isDev) {
    const ok =
      helper === "container"
        ? validIdent.test(name) && !reservedNames.has(name.toLowerCase())
        : validModifier.test(name);
    if (!ok) warnBadName(helper, name);
  }
  return `${prefix}/${name}`;
}

/**
 * Apply classes when a **named** parent group is in the given state.
 *
 * Tailwind's plain `group-*` variants reach the nearest `group` ancestor, which is
 * ambiguous the moment groups nest — a row inside a card, a card inside a list. Mark
 * the parent `group/name` and this targets that one:
 *
 * ```tsx
 * <li className="group/row">
 *   <span className={group("row", "hover", "underline")} />
 * </li>
 * ```
 *
 * The unnamed form is already a key, so write that as `ss({ "group-hover": … })` or
 * `on("group-hover", …)`.
 *
 * @example
 * group("row", "hover", "underline");     // => "group-hover/row:underline"
 * group("card", "focus-within", "ring-2") // => "group-focus-within/card:ring-2"
 */
export function group(name: string, state: ElementStateKey, classes: ClassValue): string {
  return cn(withPrefix(named("group", name, `group-${state}`), classes));
}

/**
 * Apply classes when a **named** sibling peer is in the given state — the sibling
 * counterpart of {@link group}, for a `peer/name` element earlier in the markup.
 *
 * ```tsx
 * <input className="peer/email" />
 * <p className={peer("email", "invalid", "text-red-600")} />
 * ```
 *
 * @example
 * peer("email", "invalid", "text-red-600");  // => "peer-invalid/email:text-red-600"
 * peer("terms", "checked", "font-bold");     // => "peer-checked/terms:font-bold"
 */
export function peer(name: string, state: ElementStateKey, classes: ClassValue): string {
  return cn(withPrefix(named("peer", name, `peer-${state}`), classes));
}

/**
 * Size an element against a **named** container rather than the nearest one.
 *
 * The unnamed container keys (`@md`, `@max-md`) are already `ss` keys and measure the
 * closest `@container` ancestor. Name the container `@container/name` and this
 * targets that one, which is what makes nested containers usable:
 *
 * ```tsx
 * <aside className="@container/sidebar">
 *   <div className={container("sidebar", "@md", "grid-cols-2")} />
 * </aside>
 * ```
 *
 * The name here is stricter than a group's, because it also has to be a valid CSS
 * identifier: it cannot begin with a digit, and cannot be `none`, `and`, `or`, `not`
 * or a CSS-wide keyword. `container("2xl-panel", …)` compiles to CSS the browser
 * discards, so it warns in development.
 *
 * @example
 * container("sidebar", "@md", "grid-cols-2");  // => "@md/sidebar:grid-cols-2"
 * container("main", "@max-lg", "hidden");      // => "@max-lg/main:hidden"
 */
export function container(name: string, key: AnyContainerKey, classes: ClassValue): string {
  return cn(withPrefix(named("container", name, key), classes));
}
