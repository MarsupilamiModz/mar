export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  iconUrl?: string | null;
  accentColor?: string | null;
  sortOrder: number;
  isVisible: boolean;
  parentId: string | null;
  children: CategoryNode[];
};

export type FlatCategory = Omit<CategoryNode, "children">;

export function buildCategoryTree(flat: FlatCategory[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }

  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): (CategoryNode & { depth: number })[] {
  const out: (CategoryNode & { depth: number })[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    out.push(...flattenCategoryTree(n.children, depth + 1));
  }
  return out;
}

export function collectDescendantIds(flat: FlatCategory[], categoryId: string): string[] {
  const ids = [categoryId];
  const queue = [categoryId];
  while (queue.length) {
    const current = queue.shift()!;
    const children = flat.filter((c) => c.parentId === current);
    for (const ch of children) {
      ids.push(ch.id);
      queue.push(ch.id);
    }
  }
  return ids;
}

export function categoryBreadcrumb(flat: FlatCategory[], categoryId: string): FlatCategory[] {
  const map = new Map(flat.map((c) => [c.id, c]));
  const trail: FlatCategory[] = [];
  let current = map.get(categoryId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return trail;
}

export function formatCategoryOptions(flat: FlatCategory[]): { id: string; label: string }[] {
  const tree = buildCategoryTree(flat);
  const rows = flattenCategoryTree(tree);
  return rows.map((c) => ({
    id: c.id,
    label: `${"— ".repeat(c.depth)}${c.name}`,
  }));
}
