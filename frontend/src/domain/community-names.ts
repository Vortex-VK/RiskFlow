import type { CommunityEvidence } from "./community-evidence";
import type { Entity } from "./types";

type Factor = {
  key: string;
  score: number;
  byAccount: Map<string, number>;
  examples: { name: string; score: number }[];
};
const percent = (value: number) => `${Math.round(value * 100)}%`;
const aliases: Record<string, string> = {
  groceries: "grocery",
  utilities: "utility",
  subscriptions: "subscription",
  restaurants: "dining",
  restaurant: "dining",
};
const categoryKey = (value: string) =>
  Object.hasOwn(aliases, value) ? aliases[value]! : value;
const categoryLabel = (key: string) => key[0]!.toUpperCase() + key.slice(1);
const factorLabel = (key: string) =>
  key === "device" ? "Shared devices" : `${categoryLabel(key.slice(9))} links`;

function summarize(
  ids: string[],
  evidence: CommunityEvidence,
  entities: Map<string, Entity>,
) {
  const members = new Set(ids);
  const outsideCount = evidence.profiles.length - ids.length;
  const factors = new Map<string, Factor>();
  const accountTotals = new Map<string, number>();
  const families = new Map<string, { weight: number; accounts: Set<string> }>();
  let total = 0;
  for (const [key, feature] of evidence.features) {
    if (!feature.weight) continue;
    const accounts = [...feature.accounts].filter((id) => members.has(id));
    if (accounts.length < 2) continue;
    const id = key.slice(key.indexOf(":") + 1);
    const kind = key.startsWith("device:") ? "device" : "merchant";
    const inverseSizes = accounts.map(
      (id) => 1 / Math.sqrt(evidence.accounts.get(id)!.features.size),
    );
    const sum = inverseSizes.reduce((a, b) => a + b, 0);
    const weight =
      (feature.weight *
        (sum * sum - inverseSizes.reduce((a, b) => a + b * b, 0))) /
      2;
    const family = families.get(kind) ?? {
      weight: 0,
      accounts: new Set<string>(),
    };
    family.weight += weight;
    accounts.forEach((id) => family.accounts.add(id));
    families.set(kind, family);
    const outsideRate = outsideCount
      ? (feature.accounts.size - accounts.length) / outsideCount
      : 0;
    const concentration = Math.max(
      0,
      1 - outsideRate / (accounts.length / ids.length),
    );
    const score = weight * concentration;
    if (score <= 0) continue;
    // Mixed categories remain unattributed; never turn one multi-category merchant
    // into several full-strength connections or assume a category from its name.
    const categories = new Set(
      [...(evidence.merchantCategories.get(id) ?? ["other"])].map(categoryKey),
    );
    const category =
      kind === "device"
        ? "device"
        : `merchant:${categories.size === 1 ? [...categories][0]! : "mixed"}`;
    const factor = factors.get(category) ?? {
      key: category,
      score: 0,
      byAccount: new Map<string, number>(),
      examples: [],
    };
    factor.score += score;
    factor.examples.push({ name: entities.get(id)?.name ?? id, score });
    accounts.forEach((id, i) => {
      // Use actual incident pair contributions: weak token participation cannot
      // inflate a category's coverage of the whole sector.
      const contribution =
        feature.weight *
        inverseSizes[i]! *
        (sum - inverseSizes[i]!) *
        concentration;
      factor.byAccount.set(id, (factor.byAccount.get(id) ?? 0) + contribution);
      accountTotals.set(id, (accountTotals.get(id) ?? 0) + contribution);
    });
    factors.set(category, factor);
    total += score;
  }
  return { ids, factors, accountTotals, families, total };
}

// Compare sibling communities using feature weights from the full scenario.
export function nameCommunities(
  groups: string[][],
  evidence: CommunityEvidence,
  entities: Map<string, Entity>,
) {
  const summaries = groups.map((ids) => summarize(ids, evidence, entities));
  return summaries.map((summary, index) => {
    const { ids, total, accountTotals, families } = summary;
    if (ids.length === 1)
      return {
        label: entities.get(ids[0]!)?.name ?? ids[0]!,
        reason: "Payments from this account",
      };
    const peers = summaries.filter((_, i) => i !== index);
    const peerTotal = peers.reduce((sum, p) => sum + p.total, 0);
    const factors = [...summary.factors.values()]
      .map((f) => {
        const share = total ? f.score / total : 0;
        const comparison = peerTotal
          ? peers.reduce(
              (sum, p) => sum + (p.factors.get(f.key)?.score ?? 0),
              0,
            ) / peerTotal
          : 0;
        const support = ids.filter(
          (id) =>
            (f.byAccount.get(id) ?? 0) > 0 &&
            (f.byAccount.get(id) ?? 0) >= 0.1 * (accountTotals.get(id) ?? 0),
        ).length;
        const eligible =
          !["other", "mixed", "unknown", "uncategorized"].includes(
            f.key.slice(9),
          ) &&
          support / ids.length >= 0.6 &&
          share >= 0.15 &&
          (peerTotal
            ? share - comparison >= 0.1 && share >= 1.5 * comparison
            : share >= 0.5);
        return { ...f, share, comparison, support, eligible };
      })
      .sort(
        (a, b) =>
          b.share - b.comparison - (a.share - a.comparison) ||
          b.share - a.share ||
          a.key.localeCompare(b.key),
      );
    const selected = factors.filter((f) => f.eligible).slice(0, 3);
    // A common background device must not become the fallback explanation when
    // only merchant connections distinguish these accounts from other sectors.
    const fallbackFamilies = total
      ? new Map<string, { weight: number; accounts: Set<string> }>()
      : families;
    if (total)
      for (const kind of ["device", "merchant"]) {
        const matching = factors.filter(
          (f) => (f.key === "device") === (kind === "device"),
        );
        fallbackFamilies.set(kind, {
          weight: matching.reduce((sum, f) => sum + f.score, 0),
          accounts: new Set(
            ids.filter((id) => {
              const contribution = matching.reduce(
                (sum, f) => sum + (f.byAccount.get(id) ?? 0),
                0,
              );
              return (
                contribution > 0 &&
                contribution >= 0.1 * (accountTotals.get(id) ?? 0)
              );
            }),
          ),
        });
      }
    const rawTotal = [...fallbackFamilies.values()].reduce(
      (sum, f) => sum + f.weight,
      0,
    );
    const fallback = [...fallbackFamilies]
      .filter(
        ([, f]) =>
          f.accounts.size / ids.length >= 0.6 && f.weight / rawTotal >= 0.25,
      )
      .sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]))
      .map(([kind]) =>
        kind === "device" ? "Shared devices" : "Mixed merchant links",
      );
    const label =
      selected.length === 1 && selected[0]!.key !== "device"
        ? `${categoryLabel(selected[0]!.key.slice(9))}-linked accounts`
        : selected.length
          ? selected.map((f) => factorLabel(f.key)).join(" + ")
          : fallback.join(" + ") || "Account group";
    const details = factors.filter((f) => f.eligible).slice(0, 3);
    if (!details.length) details.push(...factors.slice(0, 3));
    return {
      label,
      reason: [
        "Accounts grouped by connections stronger than the graph-wide baseline.",
        "Names summarize distinguishing connections across accounts, not spending shares.",
        ...details.flatMap((f) => [
          `${factorLabel(f.key)}: substantial links for ${f.support} of ${ids.length} accounts; ${percent(f.share)} of distinguishing connection evidence here${peerTotal ? ` versus ${percent(f.comparison)} across other sectors at this level` : "; no comparable connection evidence in other sectors at this level"}.`,
          `Contributors include ${[...f.examples]
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, 3)
            .map((e) => e.name)
            .join(", ")}.`,
        ]),
        ...(!selected.length
          ? [
              "No category meets all naming thresholds for connection strength, difference from other sectors, and account coverage.",
            ]
          : []),
        "Common merchant overlap is discounted; unknown devices provide no shared-device evidence.",
      ].join("\n"),
    };
  });
}
