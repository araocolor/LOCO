create or replace function get_bookmark_counts(class_ids uuid[])
returns table(class_id uuid, count bigint)
language sql stable
as $$
  select cb.class_id, count(*)::bigint
  from class_bookmarks cb
  where cb.class_id = any(class_ids)
  group by cb.class_id;
$$;
