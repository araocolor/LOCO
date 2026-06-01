export const SEARCH_DEFAULTS_STORAGE_KEY = "loco_search_defaults";

export interface SearchOptions {
  region: string;
  period: string;
  venue: string;
  genre: string[];
  class_type: string[];
}

export function getSearchYear() {
  return new Date().getFullYear();
}

export const PREVIOUS_YEAR_PERIOD_VALUE = "previous-year";

export function getPeriodOptions(year = getSearchYear()) {
  return [
    { value: PREVIOUS_YEAR_PERIOD_VALUE, label: String(year - 1) },
    { value: "전체", label: String(year) },
    { value: "1", label: "1월" },
    { value: "2", label: "2월" },
    { value: "3", label: "3월" },
    { value: "4", label: "4월" },
    { value: "5", label: "5월" },
    { value: "6", label: "6월" },
    { value: "7", label: "7월" },
    { value: "8", label: "8월" },
    { value: "9", label: "9월" },
    { value: "10", label: "10월" },
    { value: "11", label: "11월" },
    { value: "12", label: "12월" },
  ] as const;
}

export const CLASS_TYPES = [
  { value: "festival", label: "페스티발" },
  { value: "party", label: "이벤트/파티" },
  { value: "level_class", label: "레벨강습" },
  { value: "practice", label: "연습모임" },
  { value: "private_training", label: "1:1트레이닝" },
  { value: "choreo_class", label: "안무반" },
  { value: "etc", label: "기타" },
] as const;

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  region: "전체",
  period: "전체",
  venue: "전체",
  genre: [],
  class_type: [],
};

export function buildSearchQuery(opts: SearchOptions) {
  const params = new URLSearchParams();
  if (opts.region !== "전체") params.set("region", opts.region);
  if (opts.period !== "전체") params.set("period", opts.period);
  if (opts.venue !== "전체") params.set("venue", opts.venue);
  opts.genre.forEach((g) => params.append("genre", g));
  return params.toString();
}
