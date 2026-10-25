// Groups AniList entries into a series (DESIGN.md section 2 and the approved series plan).
// Pure logic: the caller supplies `fetchMedia`, so tests run without the network.

export type GraphNode = {
  id: number;
  type: string | null;
  format: string | null;
  startDate: string | null;
  title: string;
};

export type GraphEdge = { relationType: string; node: GraphNode };

export type GraphMedia = GraphNode & { edges: GraphEdge[] };

export type FetchMedia = (id: number) => Promise<GraphMedia | null>;

export type EntryKind = "tv" | "movie" | "ova" | "special";

export type SeriesEntry = {
  id: number;
  title: string;
  format: string | null;
  startDate: string | null;
  kind: EntryKind;
  // "SS1", "SS2" when the series has more than one TV season. Otherwise null.
  seasonLabel: string | null;
  sortOrder: number;
};

// Keeps the walk small. One Piece has dozens of specials on AniList, so extras are capped.
export const MAX_TV_ENTRIES = 20;
export const MAX_EXTRA_ENTRIES = 30;
export const MAX_FETCHES = 60;

const CHAIN_RELATIONS = new Set(["PREQUEL", "SEQUEL"]);
const EXTRA_RELATIONS = new Set(["SIDE_STORY", "SUMMARY"]);
const TV_FORMATS = new Set(["TV", "TV_SHORT"]);
const EXTRA_KINDS: Record<string, EntryKind> = { MOVIE: "movie", OVA: "ova", SPECIAL: "special" };

export function kindOf(format: string | null): EntryKind | null {
  if (format && TV_FORMATS.has(format)) return "tv";
  if (format && EXTRA_KINDS[format]) return EXTRA_KINDS[format];
  return null;
}

// Walks PREQUEL/SEQUEL to find every TV season, then adds movies, OVAs and specials that
// are linked to a season by SIDE_STORY or SUMMARY. ALTERNATIVE, CHARACTER, SOURCE and
// OTHER edges are ignored.
export async function resolveSeriesGraph(rootId: number, fetchMedia: FetchMedia): Promise<SeriesEntry[]> {
  const root = await fetchMedia(rootId);
  if (!root || root.type !== "ANIME" || kindOf(root.format) !== "tv") return [];

  const tvNodes = new Map<number, GraphMedia>([[root.id, root]]);
  const queue: GraphMedia[] = [root];
  let fetches = 1;

  while (queue.length > 0 && tvNodes.size < MAX_TV_ENTRIES && fetches < MAX_FETCHES) {
    const current = queue.shift()!;
    for (const edge of current.edges) {
      if (!CHAIN_RELATIONS.has(edge.relationType)) continue;
      if (edge.node.type !== "ANIME" || kindOf(edge.node.format) !== "tv") continue;
      if (tvNodes.has(edge.node.id)) continue;
      if (fetches >= MAX_FETCHES) break;

      const full = await fetchMedia(edge.node.id);
      fetches++;
      if (!full) continue;
      tvNodes.set(full.id, full);
      queue.push(full);
    }
  }

  const extras = new Map<number, GraphNode>();
  for (const tv of tvNodes.values()) {
    for (const edge of tv.edges) {
      if (!EXTRA_RELATIONS.has(edge.relationType)) continue;
      if (edge.node.type !== "ANIME" || tvNodes.has(edge.node.id)) continue;
      if (!kindOf(edge.node.format) || kindOf(edge.node.format) === "tv") continue;
      if (extras.size >= MAX_EXTRA_ENTRIES) break;
      extras.set(edge.node.id, edge.node);
    }
  }

  const tvSorted = [...tvNodes.values()].sort(byStartDate);
  const extrasSorted = [...extras.values()].sort(byStartDate);
  const labelled = tvSorted.length > 1;

  const entries: SeriesEntry[] = [];
  for (const node of [...tvSorted, ...extrasSorted]) {
    const kind = kindOf(node.format)!;
    const tvIndex = tvSorted.findIndex((tv) => tv.id === node.id);
    entries.push({
      id: node.id,
      title: node.title,
      format: node.format,
      startDate: node.startDate,
      kind,
      seasonLabel: kind === "tv" && labelled ? `SS${tvIndex + 1}` : null,
      sortOrder: entries.length,
    });
  }
  return entries;
}

// Name of the franchise, taken from the first TV season with the season suffix removed.
// "Jujutsu Kaisen 2nd Season" -> "Jujutsu Kaisen".
export function seriesTitleFrom(romaji: string): string {
  const stripped = romaji
    .replace(/\s*:\s*[^:]*season\s*\d*$/i, "")
    .replace(/\s+(\d+(st|nd|rd|th)\s+season|season\s*\d+|part\s*\d+|s\d+)$/i, "")
    .replace(/\s+(II|III|IV)$/, "")
    .trim();
  return stripped || romaji;
}

function byStartDate(a: { startDate: string | null; id: number }, b: { startDate: string | null; id: number }) {
  const left = a.startDate ?? "9999-12-31";
  const right = b.startDate ?? "9999-12-31";
  return left === right ? a.id - b.id : left < right ? -1 : 1;
}
