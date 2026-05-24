export const SEARCH_DEFAULTS_STORAGE_KEY = "loco_search_defaults";

export interface SearchOptions {
  region: string;
  status: string;
  venue: string;
  genre: string[];
  class_type: string[];
}

export const CLASS_TYPES = [
  { value: "festival", label: "페스티발" },
  { value: "party", label: "파티" },
  { value: "level_class", label: "레벨강습" },
  { value: "practice", label: "연습모임" },
  { value: "private_training", label: "1:1트레이닝" },
  { value: "etc", label: "기타" },
] as const;

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  region: "전체",
  status: "recruiting",
  venue: "전체",
  genre: [],
  class_type: [],
};

export function buildSearchQuery(opts: SearchOptions) {
  const params = new URLSearchParams();
  if (opts.region !== "전체") params.set("region", opts.region);
  if (opts.status !== "전체") params.set("status", opts.status);
  if (opts.venue !== "전체") params.set("venue", opts.venue);
  opts.genre.forEach((g) => params.append("genre", g));
  return params.toString();
}
