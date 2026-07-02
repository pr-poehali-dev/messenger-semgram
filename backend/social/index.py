import json
import os
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def _resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'isBase64Encoded': False, 'body': json.dumps(body, ensure_ascii=False)}


def _hash(p: str) -> str:
    return hashlib.sha256(p.encode()).hexdigest()


def _ensure_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(200) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(30) NOT NULL DEFAULT 'member',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("""
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('DezeYT', 'dezeyt', %s, 'owner')
        ON CONFLICT (email) DO NOTHING
    """, (_hash('ermolovo4'),))
    cur.execute("""
        CREATE TABLE IF NOT EXISTS friends (
            id SERIAL PRIMARY KEY,
            from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            to_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(from_user_id, to_user_id)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bans (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
            kind VARCHAR(10) NOT NULL DEFAULT 'ban',
            reason VARCHAR(255),
            issued_by INT NOT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)


def handler(event: dict, context) -> dict:
    '''Социальные функции semGramm: поиск юзеров, заявки в друзья, баны и муты (только для владельца).'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            return _resp(400, {'error': 'Некорректный JSON'})

    me_id = int(body.get('me_id') or params.get('me_id') or 0)

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()
        _ensure_tables(cur)
        conn.commit()

        # --- Поиск пользователей по нику или email ---
        if action == 'search':
            q = (body.get('q') or params.get('q') or '').strip().lower()
            if len(q) < 2:
                return _resp(400, {'error': 'Введите минимум 2 символа'})
            cur.execute("""
                SELECT id, name, email, role FROM users
                WHERE (LOWER(name) LIKE %s OR LOWER(email) LIKE %s)
                  AND id != %s
                LIMIT 20
            """, (f'%{q}%', f'%{q}%', me_id or 0))
            rows = cur.fetchall()
            users = [{'id': r[0], 'name': r[1], 'email': r[2], 'role': r[3]} for r in rows]
            return _resp(200, {'users': users})

        # --- Отправить заявку в друзья ---
        if action == 'add_friend':
            to_id = int(body.get('to_id') or 0)
            if not me_id or not to_id:
                return _resp(400, {'error': 'Не указаны пользователи'})
            if me_id == to_id:
                return _resp(400, {'error': 'Нельзя добавить себя'})
            # Проверяем бан
            cur.execute("SELECT kind FROM bans WHERE user_id = %s", (me_id,))
            ban = cur.fetchone()
            if ban:
                return _resp(403, {'error': 'Ваш аккаунт заблокирован' if ban[0] == 'ban' else 'Вы не можете отправлять заявки'})
            cur.execute("""
                INSERT INTO friends (from_user_id, to_user_id, status)
                VALUES (%s, %s, 'pending')
                ON CONFLICT (from_user_id, to_user_id) DO NOTHING
            """, (me_id, to_id))
            conn.commit()
            return _resp(200, {'ok': True})

        # --- Принять/отклонить заявку ---
        if action == 'respond_friend':
            req_id = int(body.get('request_id') or 0)
            accept = body.get('accept', False)
            if not req_id:
                return _resp(400, {'error': 'Не указана заявка'})
            if accept:
                cur.execute("UPDATE friends SET status='accepted' WHERE id=%s AND to_user_id=%s", (req_id, me_id))
            else:
                cur.execute("DELETE FROM friends WHERE id=%s AND to_user_id=%s", (req_id, me_id))
            conn.commit()
            return _resp(200, {'ok': True})

        # --- Список друзей и входящих заявок ---
        if action == 'friends':
            if not me_id:
                return _resp(400, {'error': 'Не указан пользователь'})
            # Принятые друзья
            cur.execute("""
                SELECT u.id, u.name, u.email, u.role, f.id
                FROM friends f
                JOIN users u ON (
                    CASE WHEN f.from_user_id = %s THEN f.to_user_id ELSE f.from_user_id END = u.id
                )
                WHERE (f.from_user_id = %s OR f.to_user_id = %s) AND f.status = 'accepted'
            """, (me_id, me_id, me_id))
            friends = [{'id': r[0], 'name': r[1], 'email': r[2], 'role': r[3]} for r in cur.fetchall()]
            # Входящие заявки
            cur.execute("""
                SELECT f.id, u.id, u.name, u.email FROM friends f
                JOIN users u ON u.id = f.from_user_id
                WHERE f.to_user_id = %s AND f.status = 'pending'
            """, (me_id,))
            incoming = [{'request_id': r[0], 'id': r[1], 'name': r[2], 'email': r[3]} for r in cur.fetchall()]
            # Исходящие заявки
            cur.execute("""
                SELECT f.id, u.id, u.name, u.email FROM friends f
                JOIN users u ON u.id = f.to_user_id
                WHERE f.from_user_id = %s AND f.status = 'pending'
            """, (me_id,))
            outgoing = [{'request_id': r[0], 'id': r[1], 'name': r[2], 'email': r[3]} for r in cur.fetchall()]
            return _resp(200, {'friends': friends, 'incoming': incoming, 'outgoing': outgoing})

        # --- Бан / мут / снятие (только owner) ---
        if action in ('ban', 'mute', 'unban'):
            cur.execute("SELECT role FROM users WHERE id = %s", (me_id,))
            row = cur.fetchone()
            if not row or row[0] != 'owner':
                return _resp(403, {'error': 'Нет прав'})
            target_id = int(body.get('target_id') or 0)
            if not target_id:
                return _resp(400, {'error': 'Не указан пользователь'})
            reason = (body.get('reason') or '').strip()[:255]
            if action == 'unban':
                cur.execute("DELETE FROM bans WHERE user_id = %s", (target_id,))
            else:
                cur.execute("""
                    INSERT INTO bans (user_id, kind, reason, issued_by)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET kind=EXCLUDED.kind, reason=EXCLUDED.reason, issued_by=EXCLUDED.issued_by, created_at=NOW()
                """, (target_id, action, reason, me_id))
            conn.commit()
            return _resp(200, {'ok': True})

        # --- Список всех юзеров для панели владельца ---
        if action == 'all_users':
            cur.execute("SELECT role FROM users WHERE id = %s", (me_id,))
            row = cur.fetchone()
            if not row or row[0] != 'owner':
                return _resp(403, {'error': 'Нет прав'})
            cur.execute("""
                SELECT u.id, u.name, u.email, u.role, b.kind, b.reason
                FROM users u
                LEFT JOIN bans b ON b.user_id = u.id
                ORDER BY u.created_at DESC
            """)
            users = [{'id': r[0], 'name': r[1], 'email': r[2], 'role': r[3], 'ban': r[4], 'ban_reason': r[5]} for r in cur.fetchall()]
            return _resp(200, {'users': users})

        return _resp(400, {'error': f'Неизвестное действие: {action}'})
    finally:
        conn.close()
