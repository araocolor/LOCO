-- 회원검색(닉네임 부분일치) 가속용 인덱스
-- /api/users/search 의 nickname.ilike.%검색어% 쿼리는 앞에 %가 붙어
-- 일반 인덱스를 타지 못하고 테이블 전체를 훑는다.
-- pg_trgm 의 GIN 인덱스를 쓰면 부분일치(ilike) 검색이 인덱스를 타게 되어
-- 회원 수가 수만 명으로 늘어도 검색 속도가 유지된다.

-- 부분일치 검색을 인덱스로 지원하는 확장
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- nickname 부분일치(ilike) 검색용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_nickname_trgm
  ON profiles USING gin (nickname gin_trgm_ops);
