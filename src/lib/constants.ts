export const REGIONS = [
  "경기도",
  "인천",
  "서울",
  "대전",
  "대구",
  "광주",
  "창원",
  "포항",
  "울산",
  "부산",
  "제주",
] as const;

export type Region = (typeof REGIONS)[number];

export const REGIONS_WITH_ALL = ["전체", ...REGIONS] as const;

export const GENRES = [
  { value: "salsa", label: "살사" },
  { value: "bachata", label: "바차타" },
  { value: "other", label: "기타" },
] as const;

export const CATEGORIES = [
  { value: "event", label: "이벤트" },
  { value: "regular", label: "정규강습" },
  { value: "practice", label: "연습모임" },
  { value: "training", label: "1:1트레이닝" },
  { value: "choreography", label: "안무반" },
  { value: "festival", label: "페스티발" },
] as const;

export const LEVELS = [
  { value: "beginner", label: "입문" },
  { value: "elementary", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
  { value: "all", label: "올레벨" },
] as const;

export const CLASS_STATUSES = [
  { value: "recruiting", label: "모집중" },
  { value: "closed", label: "마감" },
  { value: "cancelled", label: "취소" },
] as const;

export const CLASS_TYPES = [
  { value: "group", label: "그룹" },
  { value: "private", label: "1:1" },
] as const;

export const MEMBER_TYPES = [
  "일반회원", "운영진", "인스트럭터", "인플루언서",
  "프로댄서", "오거나이저", "아카데미대표", "독립군",
  "왕초보", "Artist", "클럽공식채널",
] as const;

export const MAX_MEMBER_TYPE = 3;

export const VENUES = [
  { value: "전체", label: "전체" },
  { value: "gang", label: "강턴" },
  { value: "hong", label: "홍턴" },
  { value: "latin", label: "라틴" },
  { value: "lueda", label: "루에다" },
  { value: "mambo", label: "맘보바" },
  { value: "lalala", label: "라라라" },
  { value: "havana", label: "하바나" },
  { value: "buenavista", label: "부에나비스타" },
  { value: "mayan", label: "마얀" },
  { value: "sns", label: "대전 SNS" },
] as const;
