import type { CourseRequirement } from "./db";

// Pure layout math for the decorative /tree/ page: turns the same AND-of-OR
// requirement data /courses/ renders as a table into node positions and SVG
// edge paths. A course's column is 1 + the deepest of its prerequisite
// options (deepest, not quickest, even within an OR group) — not how many
// semesters a real plan schedules it, which is the plan page's job, not this
// one's. Deepest-option keeps every option strictly to the left of the
// course that needs it, so every edge is drawn left-to-right; a
// quickest-option reading could put a course in the same column as one of
// its own options, drawing a backward-curving edge.

export const TREE_NODE_WIDTH = 150;
export const TREE_NODE_HEIGHT = 44;
const COL_GAP = 90;
const ROW_GAP = 24;
const MARGIN = 30;

export type TreeNode = { id: number; code: string; title: string; x: number; y: number };
export type TreeEdge = { path: string; groupIndex: number; isOr: boolean };
export type TreeLayout = { nodes: TreeNode[]; edges: TreeEdge[]; width: number; height: number };

function depthOf(
  id: number,
  byId: Map<number, CourseRequirement>,
  memo: Map<number, number>,
): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  const requirement = byId.get(id);
  if (!requirement || requirement.groups.length === 0) {
    memo.set(id, 0);
    return 0;
  }
  const depth =
    1 +
    Math.max(
      ...requirement.groups.map((group) =>
        Math.max(...group.map((option) => depthOf(option.id, byId, memo))),
      ),
    );
  memo.set(id, depth);
  return depth;
}

export function layoutTree(requirements: CourseRequirement[]): TreeLayout {
  const byId = new Map(requirements.map((r) => [r.course.id, r]));
  const memo = new Map<number, number>();

  const columns = new Map<number, CourseRequirement[]>();
  for (const r of requirements) {
    const depth = depthOf(r.course.id, byId, memo);
    const column = columns.get(depth) ?? [];
    column.push(r);
    columns.set(depth, column);
  }
  for (const column of columns.values()) {
    column.sort((a, b) => a.course.code.localeCompare(b.course.code));
  }

  const positions = new Map<number, { x: number; y: number }>();
  let maxRows = 1;
  for (const [depth, column] of columns) {
    maxRows = Math.max(maxRows, column.length);
    column.forEach((r, row) => {
      positions.set(r.course.id, {
        x: MARGIN + depth * (TREE_NODE_WIDTH + COL_GAP),
        y: MARGIN + row * (TREE_NODE_HEIGHT + ROW_GAP),
      });
    });
  }
  const maxCol = columns.size === 0 ? 0 : Math.max(...columns.keys());

  const nodes: TreeNode[] = requirements.map((r) => {
    const pos = positions.get(r.course.id);
    if (!pos) throw new Error(`no layout position for course ${r.course.code}`);
    return { id: r.course.id, code: r.course.code, title: r.course.title, x: pos.x, y: pos.y };
  });

  const edges: TreeEdge[] = [];
  for (const r of requirements) {
    const target = positions.get(r.course.id);
    if (!target) continue;
    r.groups.forEach((group, groupIndex) => {
      const anchorY = target.y + ((groupIndex + 1) * TREE_NODE_HEIGHT) / (r.groups.length + 1);
      const anchorX = target.x;
      for (const option of group) {
        const source = positions.get(option.id);
        if (!source) continue;
        const sx = source.x + TREE_NODE_WIDTH;
        const sy = source.y + TREE_NODE_HEIGHT / 2;
        const midX = (sx + anchorX) / 2;
        edges.push({
          path: `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${anchorY}, ${anchorX} ${anchorY}`,
          groupIndex,
          isOr: group.length > 1,
        });
      }
    });
  }

  const width = MARGIN * 2 + (maxCol + 1) * TREE_NODE_WIDTH + maxCol * COL_GAP;
  const height = MARGIN * 2 + maxRows * TREE_NODE_HEIGHT + (maxRows - 1) * ROW_GAP;

  return { nodes, edges, width, height };
}
