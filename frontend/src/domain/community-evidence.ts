import type { Entity, Payment } from "./types";

type AccountProfile = {
  id: string;
  features: Set<string>;
  categories: Map<string, number>;
  payments: number;
};
export type CommunityEvidence = ReturnType<typeof communityEvidence>;

// The same feature weights feed both partitioning and its explanations.
export function communityEvidence(
  payments: Payment[],
  entities = new Map<string, Entity>(),
) {
  const accounts = new Map<string, AccountProfile>();
  const merchantCategories = new Map<string, Set<string>>();
  for (const p of payments) {
    let profile = accounts.get(p.accountId);
    if (!profile) {
      profile = {
        id: p.accountId,
        features: new Set(),
        categories: new Map(),
        payments: 0,
      };
      accounts.set(p.accountId, profile);
    }
    profile.features.add(`merchant:${p.merchantId}`);
    if (!p.unavailableRules?.includes("shared_device_accounts"))
      profile.features.add(`device:${p.deviceId}`);
    const merchant = entities.get(p.merchantId);
    const category =
      p.category ??
      (merchant?.type === "merchant" ? merchant.category : "other");
    const sourceCategory = (p.sourceCategory?.trim() || category)
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
    const observed = merchantCategories.get(p.merchantId) ?? new Set<string>();
    observed.add(sourceCategory);
    merchantCategories.set(p.merchantId, observed);
    profile.categories.set(
      category,
      (profile.categories.get(category) ?? 0) + 1,
    );
    profile.payments++;
  }
  const profiles = [...accounts.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const features = new Map<string, { weight: number; accounts: Set<string> }>();
  for (const profile of profiles)
    for (const key of profile.features) {
      let feature = features.get(key);
      if (!feature) {
        feature = { weight: 0, accounts: new Set() };
        features.set(key, feature);
      }
      feature.accounts.add(profile.id);
    }
  for (const [key, feature] of features) {
    const frequency = feature.accounts.size;
    feature.weight =
      (key.startsWith("device:") ? 8 : 1 - frequency / profiles.length) /
      frequency;
  }
  const edges: { a: string; b: string; weight: number }[] = [];
  for (let i = 0; i < profiles.length; i++)
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i]!,
        b = profiles[j]!;
      let weight = 0;
      for (const key of a.features)
        if (b.features.has(key)) weight += features.get(key)!.weight;
      if (weight)
        edges.push({
          a: a.id,
          b: b.id,
          weight: weight / Math.sqrt(a.features.size * b.features.size),
        });
    }
  return { profiles, features, edges, accounts, merchantCategories };
}
