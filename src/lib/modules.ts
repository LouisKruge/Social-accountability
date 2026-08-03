/**
 * Commit's module definitions.
 *
 * These live apart from `src/lib/exchange.ts` for a structural reason: the rail
 * and the command bar are CLIENT components and need this list, while the
 * loader beside it opens a database connection and pulls in node:async_hooks.
 * Importing a constant from that file dragged the whole server graph into the
 * browser bundle — which surfaced as a build error only once the timing module
 * added a node: import, and had been quietly inflating the client bundle before
 * that.
 *
 * Nothing in this file may import anything server-side. That is the whole point
 * of it existing.
 */

export type ModuleKey =
  | "market"
  | "portfolio"
  | "treasury"
  | "lab"
  | "trust"
  | "floor"
  | "standing";

export interface ModuleDef {
  key: ModuleKey;
  href: string;
  name: string;
  /** What question this module answers. Shown under the name. */
  question: string;
}

/**
 * The seven modules. Each is named for what it IS rather than what it does, and
 * each carries the single question it exists to answer — if a module can't name
 * its question it shouldn't be a module.
 */
export const MODULES: ModuleDef[] = [
  { key: "portfolio", href: "/commit/portfolio", name: "Portfolio", question: "What am I holding?" },
  { key: "market", href: "/commit/market", name: "Market", question: "What can I take on?" },
  { key: "treasury", href: "/commit/wallet", name: "Treasury", question: "Where is my money?" },
  { key: "lab", href: "/commit/lab", name: "Lab", question: "Am I actually improving?" },
  { key: "floor", href: "/commit/floor", name: "Floor", question: "Who am I up against?" },
  { key: "trust", href: "/commit/trust", name: "Trust", question: "Can this be verified?" },
  { key: "standing", href: "/commit/standing", name: "Standing", question: "What have I earned?" },
];
