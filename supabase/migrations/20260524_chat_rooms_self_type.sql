-- chat_rooms.type 제약조건에 'self' 추가
ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_type_check;
ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_type_check CHECK (type IN ('direct', 'group', 'class', 'self'));
