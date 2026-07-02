import json
import os
import re
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def _resp(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS, 'isBase64Encoded': False, 'body': json.dumps(body)}


def _user_dict(row) -> dict:
    return {'id': row[0], 'name': row[1], 'email': row[2], 'role': row[3]}


def handler(event: dict, context) -> dict:
    '''Регистрация и вход пользователей мессенджера semGramm. Хранит аккаунты в PostgreSQL.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'isBase64Encoded': False, 'body': ''}

    if method != 'POST':
        return _resp(405, {'error': 'Метод не поддерживается'})

    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'login')

    try:
        data = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return _resp(400, {'error': 'Некорректные данные'})

    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()

        if action == 'register':
            name = (data.get('name') or '').strip()
            if not name:
                return _resp(400, {'error': 'Укажите имя'})
            if not EMAIL_RE.match(email):
                return _resp(400, {'error': 'Некорректный email'})
            if len(password) < 6:
                return _resp(400, {'error': 'Пароль должен быть не короче 6 символов'})

            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return _resp(409, {'error': 'Пользователь с таким email уже существует'})

            cur.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, 'member') "
                "RETURNING id, name, email, role",
                (name, email, _hash(password)),
            )
            row = cur.fetchone()
            conn.commit()
            return _resp(200, {'user': _user_dict(row)})

        # login
        cur.execute(
            "SELECT id, name, email, role, password_hash FROM users WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()
        if not row or row[4] != _hash(password):
            return _resp(401, {'error': 'Неверный email или пароль'})

        return _resp(200, {'user': _user_dict(row)})
    finally:
        conn.close()
