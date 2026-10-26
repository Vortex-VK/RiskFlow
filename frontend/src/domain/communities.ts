export type AccountCommunity = {
  accounts: string[];
  affinity: number;
  children: AccountCommunity[];
};
export type WeightedConnection = { a: string; b: string; weight: number };
type Candidate = { gain: number; a: number; b: number; va: number; vb: number };
const EPSILON = 1e-12;

// Weighted greedy modularity, resolution 1. Only positive improvements merge.
// https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.community.quality.modularity.html
export function partitionCommunities(
  ids: string[],
  edges: WeightedConnection[],
): AccountCommunity[] {
  const accounts = [...ids].sort();
  const index = new Map(accounts.map((id, i) => [id, i]));
  const size = accounts.length;
  const weights = Array.from({ length: size }, () => new Float64Array(size));
  const degrees = new Float64Array(size);
  const internal = new Float64Array(size);
  const versions = new Uint32Array(size);
  const groups: (AccountCommunity | null)[] = accounts.map((id) => ({
    accounts: [id],
    affinity: Infinity,
    children: [],
  }));
  let total = 0;
  for (const edge of edges) {
    const a = index.get(edge.a),
      b = index.get(edge.b);
    if (
      a === undefined ||
      b === undefined ||
      a === b ||
      !(edge.weight > 0) ||
      !Number.isFinite(edge.weight)
    )
      continue;
    weights[a]![b] = weights[a]![b]! + edge.weight;
    weights[b]![a] = weights[b]![a]! + edge.weight;
    degrees[a] = degrees[a]! + edge.weight;
    degrees[b] = degrees[b]! + edge.weight;
    total += edge.weight;
  }
  const heap: Candidate[] = [];
  const better = (a: Candidate, b: Candidate) =>
    a.gain > b.gain ||
    (a.gain === b.gain && (a.a < b.a || (a.a === b.a && a.b < b.b)));
  function push(a: number, b: number) {
    if (!total || !weights[a]![b]) return;
    const gain =
      weights[a]![b]! / total -
      ((degrees[a]! / total) * (degrees[b]! / total)) / 2;
    if (gain <= EPSILON) return;
    const candidate = { gain, a, b, va: versions[a]!, vb: versions[b]! };
    let i = heap.length;
    heap.push(candidate);
    while (i) {
      const parent = (i - 1) >> 1;
      if (!better(candidate, heap[parent]!)) break;
      heap[i] = heap[parent]!;
      i = parent;
    }
    heap[i] = candidate;
  }
  function pop() {
    const best = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let next = i * 2 + 1;
        if (next + 1 < heap.length && better(heap[next + 1]!, heap[next]!))
          next++;
        if (!better(heap[next]!, last)) break;
        heap[i] = heap[next]!;
        i = next;
      }
      heap[i] = last;
    }
    return best;
  }
  for (let a = 0; a < size; a++) for (let b = a + 1; b < size; b++) push(a, b);
  while (heap.length) {
    const { a, b, va, vb } = pop();
    if (!groups[a] || !groups[b] || versions[a] !== va || versions[b] !== vb)
      continue;
    const left = groups[a]!,
      right = groups[b]!;
    const members = [...left.accounts, ...right.accounts].sort();
    internal[a] = internal[a]! + internal[b]! + weights[a]![b]!;
    groups[a] = {
      accounts: members,
      affinity: (internal[a]! * 2) / (members.length * (members.length - 1)),
      children: [left, right],
    };
    groups[b] = null;
    degrees[a] = degrees[a]! + degrees[b]!;
    versions[a]++;
    versions[b]++;
    for (let other = 0; other < size; other++) {
      if (other === a || !groups[other]) continue;
      weights[a]![other] = weights[a]![other]! + weights[b]![other]!;
      weights[other]![a] = weights[a]![other]!;
      push(Math.min(a, other), Math.max(a, other));
    }
  }
  return groups.filter((group): group is AccountCommunity => group !== null);
}
