import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const AUTH_URL = 'https://functions.poehali.dev/6e9947a2-55b1-4132-aa98-695f7717fe3c';
const SOCIAL_URL = 'https://functions.poehali.dev/ef5cacda-3696-4009-8720-77c830f393ad';

type User = { id: number; name: string; email: string; role: string };
type FriendUser = User & { request_id?: number };
type AdminUser = User & { ban: string | null; ban_reason: string | null };

type Message = {
  id: number; fromMe: boolean; text?: string; time: string;
  file?: { name: string; kind: 'image' | 'doc'; size: string; url?: string };
};
type Chat = {
  id: number; userId: number; name: string; email: string; color: string;
  messages: Message[]; last: string; time: string;
};

const COLORS = ['from-fuchsia-500 to-purple-600','from-cyan-400 to-blue-600','from-emerald-400 to-teal-600','from-orange-400 to-rose-600','from-yellow-400 to-orange-500'];

// ─── API helpers ─────────────────────────────────────────────────────────────
const social = async (action: string, body: Record<string, unknown>) => {
  const r = await fetch(`${SOCIAL_URL}?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
};

// ─── Login ────────────────────────────────────────────────────────────────────
const Login = ({ onEnter }: { onEnter: (u: User) => void }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка'); return; }
      onEnter(data.user);
    } catch { setError('Сервер недоступен'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full brand-gradient animate-gradient-move blur-[120px] opacity-40 animate-float" />
      <div className="absolute -bottom-40 -right-40 w-[36rem] h-[36rem] rounded-full brand-gradient animate-gradient-move blur-[120px] opacity-30 animate-float" style={{ animationDelay: '2s' }} />
      <div className="relative w-full max-w-md glass-strong rounded-[2rem] p-8 md:p-10 animate-scale-in shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl brand-gradient animate-gradient-move flex items-center justify-center shadow-lg">
            <Icon name="Send" size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl tracking-tight">sem<span className="text-gradient">Gramm</span></h1>
            <p className="text-xs text-muted-foreground">Мессенджер для работы</p>
          </div>
        </div>
        <div className="flex gap-2 p-1 rounded-2xl bg-secondary/50 mb-7">
          {(['login','register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode===m ? 'brand-gradient text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'register' ? 'Регистрация' : 'Вход'}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {mode === 'register' && <Field icon="User" placeholder="Имя и фамилия" value={name} onChange={setName} />}
          <Field icon="Mail" placeholder="Email или логин" value={email} onChange={setEmail} />
          <Field icon="Lock" placeholder="Пароль" type="password" value={password} onChange={setPassword} onEnter={submit} />
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 animate-fade-in">
            <Icon name="CircleAlert" size={16} /> {error}
          </div>
        )}
        <button onClick={submit} disabled={loading}
          className="w-full mt-7 py-3.5 rounded-2xl brand-gradient animate-gradient-move text-white font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? 'Секунду...' : mode === 'register' ? 'Создать аккаунт' : 'Войти'}
          {!loading && <Icon name="ArrowRight" size={18} />}
        </button>
        <p className="text-center text-xs text-muted-foreground mt-6">Продолжая, вы соглашаетесь с условиями сервиса</p>
      </div>
    </div>
  );
};

const Field = ({ icon, placeholder, type='text', value, onChange, onEnter }: {
  icon: string; placeholder: string; type?: string; value: string; onChange: (v: string) => void; onEnter?: () => void;
}) => (
  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-secondary/40 border border-border focus-within:border-primary/60 transition-colors">
    <Icon name={icon} size={18} className="text-muted-foreground" />
    <input type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)} onKeyDown={e => e.key==='Enter' && onEnter?.()}
      className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground" />
  </div>
);

const ROLE_LABEL: Record<string,string> = { owner:'Владелец', admin:'Администратор', member:'Участник' };

// ─── Add Friend Modal ─────────────────────────────────────────────────────────
const AddFriendModal = ({ me, onClose, onAdded }: { me: User; onClose: () => void; onAdded: () => void }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState('');

  const search = async () => {
    if (q.trim().length < 2) return;
    setLoading(true);
    const d = await social('search', { q: q.trim(), me_id: me.id });
    setResults(d.users || []);
    setLoading(false);
  };

  const add = async (u: User) => {
    const d = await social('add_friend', { me_id: me.id, to_id: u.id });
    if (d.ok) { setSent(p => new Set(p).add(u.id)); setMsg('Заявка отправлена!'); onAdded(); }
    else setMsg(d.error || 'Ошибка');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong rounded-[2rem] p-6 animate-scale-in shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Добавить контакт</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-secondary/60 flex items-center justify-center"><Icon name="X" size={16} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-secondary/40 border border-border focus-within:border-primary/60 transition-colors">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && search()}
              placeholder="Ник или email..." className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground" />
          </div>
          <button onClick={search} disabled={loading}
            className="px-4 rounded-2xl brand-gradient text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-60">
            {loading ? '...' : 'Найти'}
          </button>
        </div>
        {msg && <p className="text-xs text-center text-primary mb-3 animate-fade-in">{msg}</p>}
        <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
          {results.length === 0 && q.length >= 2 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Никого не найдено</p>
          )}
          {results.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/40 transition-colors">
              <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                {u.name.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <button onClick={() => add(u)} disabled={sent.has(u.id)}
                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed brand-gradient text-white hover:scale-105">
                {sent.has(u.id) ? 'Отправлено' : 'Добавить'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Admin Panel ──────────────────────────────────────────────────────────────
const AdminPanel = ({ me, onClose }: { me: User; onClose: () => void }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionKind, setActionKind] = useState<'ban'|'mute'|'unban'>('ban');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const d = await social('all_users', { me_id: me.id });
    setUsers(d.users || []);
    setLoading(false);
  }, [me.id]);

  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!actionUser) return;
    const d = await social(actionKind, { me_id: me.id, target_id: actionUser.id, reason });
    if (d.ok) { setMsg('Готово!'); setActionUser(null); setReason(''); load(); }
    else setMsg(d.error || 'Ошибка');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-strong h-full p-6 animate-scale-in flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Icon name="ShieldAlert" size={16} className="text-rose-400" />
            </div>
            <h2 className="font-display font-bold text-lg">Панель владельца</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-secondary/60 flex items-center justify-center"><Icon name="X" size={16} /></button>
        </div>

        {msg && (
          <div className="mb-4 text-xs text-center py-2 px-4 rounded-xl bg-primary/15 text-primary animate-fade-in shrink-0">{msg}</div>
        )}

        {/* Confirm action */}
        {actionUser && (
          <div className="mb-4 p-4 rounded-2xl bg-secondary/60 border border-border animate-fade-in shrink-0">
            <p className="text-sm font-semibold mb-3">
              {actionKind === 'ban' ? '🚫 Заблокировать' : actionKind === 'mute' ? '🔇 Замутить' : '✅ Снять ограничения'} — <span className="text-primary">{actionUser.name}</span>
            </p>
            {actionKind !== 'unban' && (
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Причина (необязательно)"
                className="w-full bg-secondary/40 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60 mb-3 placeholder:text-muted-foreground" />
            )}
            <div className="flex gap-2">
              <button onClick={doAction}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] ${actionKind==='unban' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                Подтвердить
              </button>
              <button onClick={() => { setActionUser(null); setReason(''); }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-secondary/60 hover:bg-secondary transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">Загрузка...</div>
          ) : users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/40 transition-colors">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${u.ban === 'ban' ? 'bg-rose-500/60' : u.ban === 'mute' ? 'bg-yellow-500/60' : 'brand-gradient'}`}>
                {u.name.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{u.name}</span>
                  {u.role === 'owner' && <Icon name="Crown" size={12} className="text-primary shrink-0" />}
                  {u.ban === 'ban' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400">бан</span>}
                  {u.ban === 'mute' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">мут</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              {u.role !== 'owner' && (
                <div className="flex gap-1 shrink-0">
                  {u.ban ? (
                    <button onClick={() => { setActionUser(u); setActionKind('unban'); }}
                      className="w-8 h-8 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 flex items-center justify-center transition-colors" title="Снять">
                      <Icon name="ShieldCheck" size={14} className="text-emerald-400" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setActionUser(u); setActionKind('mute'); }}
                        className="w-8 h-8 rounded-xl bg-yellow-500/15 hover:bg-yellow-500/30 flex items-center justify-center transition-colors" title="Мут">
                        <Icon name="VolumeX" size={14} className="text-yellow-400" />
                      </button>
                      <button onClick={() => { setActionUser(u); setActionKind('ban'); }}
                        className="w-8 h-8 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 flex items-center justify-center transition-colors" title="Бан">
                        <Icon name="Ban" size={14} className="text-rose-400" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Messenger ────────────────────────────────────────────────────────────────
const Messenger = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [tab, setTab] = useState<'chats'|'friends'>('chats');
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = user.name.slice(0, 2).toUpperCase();
  const active = chats.find(c => c.id === activeId) || null;

  const loadFriends = useCallback(async () => {
    const d = await social('friends', { me_id: user.id });
    const accepted: FriendUser[] = d.friends || [];
    setFriends(accepted);
    setIncoming(d.incoming || []);
    // Sync chats from accepted friends
    setChats(prev => {
      const existing = new Map(prev.map(c => [c.userId, c]));
      return accepted.map((f, i) => existing.get(f.id) || {
        id: f.id, userId: f.id, name: f.name, email: f.email,
        color: COLORS[i % COLORS.length], messages: [], last: 'Нет сообщений', time: '',
      });
    });
  }, [user.id]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const send = (msg: Message) => {
    if (!activeId) return;
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, msg], last: msg.text || 'Файл', time: 'Сейчас' } : c));
  };

  const sendText = () => {
    if (!draft.trim()) return;
    send({ id: Date.now(), fromMe: true, text: draft, time: 'Сейчас' });
    setDraft('');
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImg = f.type.startsWith('image/');
    send({ id: Date.now(), fromMe: true, time: 'Сейчас', file: {
      name: f.name, kind: isImg ? 'image' : 'doc',
      size: `${(f.size/1024/1024).toFixed(1)} МБ`,
      url: isImg ? URL.createObjectURL(f) : undefined,
    }});
    e.target.value = '';
  };

  const respondFriend = async (req_id: number, accept: boolean) => {
    await social('respond_friend', { me_id: user.id, request_id: req_id, accept });
    loadFriends();
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden relative">
      <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full brand-gradient blur-[140px] opacity-20 pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-full md:w-[380px] flex flex-col glass border-r border-border relative z-10">
        {/* Header */}
        <div className="p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl brand-gradient animate-gradient-move flex items-center justify-center">
              <Icon name="Send" size={18} className="text-white" />
            </div>
            <span className="font-display font-black text-xl">sem<span className="text-gradient">Gramm</span></span>
          </div>
          <div className="flex items-center gap-2">
            {user.role === 'owner' && (
              <button onClick={() => setShowAdmin(true)}
                className="w-9 h-9 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 flex items-center justify-center transition-colors" title="Панель владельца">
                <Icon name="ShieldAlert" size={16} className="text-rose-400" />
              </button>
            )}
            <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold hover:scale-105 transition-transform">
              {initials}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex gap-2 p-1 rounded-2xl bg-secondary/50">
            {(['chats','friends'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${tab===t ? 'brand-gradient text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon name={t==='chats' ? 'MessageCircle' : 'Users'} size={14} />
                {t==='chats' ? 'Чаты' : `Контакты${incoming.length ? ` (${incoming.length})` : ''}`}
              </button>
            ))}
          </div>
        </div>

        {/* Chats list */}
        {tab === 'chats' && (
          <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-1">
            {chats.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="w-16 h-16 rounded-3xl bg-secondary/60 flex items-center justify-center mb-4">
                  <Icon name="MessagesSquare" size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold mb-1">Пока нет чатов</p>
                <p className="text-xs text-muted-foreground">Добавьте контакт во вкладке «Контакты»</p>
              </div>
            ) : chats.map((c, i) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                style={{ animationDelay: `${i*50}ms` }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all animate-slide-up text-left ${activeId===c.id ? 'glass-strong' : 'hover:bg-secondary/40'}`}>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white font-bold shrink-0`}>
                  {c.name.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.last}</div>
                </div>
                {c.time && <span className="text-[10px] text-muted-foreground shrink-0">{c.time}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Friends list */}
        {tab === 'friends' && (
          <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-2">
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1 mb-2">Входящие заявки</p>
                {incoming.map(u => (
                  <div key={u.request_id} className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/20 mb-2">
                    <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {u.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => respondFriend(u.request_id!, true)}
                        className="w-8 h-8 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition-colors">
                        <Icon name="Check" size={14} className="text-emerald-400" />
                      </button>
                      <button onClick={() => respondFriend(u.request_id!, false)}
                        className="w-8 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 flex items-center justify-center transition-colors">
                        <Icon name="X" size={14} className="text-rose-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {friends.length > 0 && <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1 mb-2">Контакты</p>}
            {friends.length === 0 && incoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 rounded-3xl bg-secondary/60 flex items-center justify-center mb-3">
                  <Icon name="UserPlus" size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold mb-1">Нет контактов</p>
                <p className="text-xs text-muted-foreground">Найдите людей по нику или email</p>
              </div>
            ) : friends.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/40 transition-colors">
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${COLORS[i%COLORS.length]} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                  {f.name.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.email}</div>
                </div>
                <button onClick={() => { setActiveId(f.id); setTab('chats'); }}
                  className="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center text-white hover:scale-105 transition-transform">
                  <Icon name="MessageCircle" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setShowAddFriend(true)}
          className="m-4 py-3 rounded-2xl brand-gradient animate-gradient-move text-white font-semibold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shrink-0">
          <Icon name="UserPlus" size={16} /> Найти контакт
        </button>
      </aside>

      {/* Chat window */}
      <main className="hidden md:flex flex-1 flex-col relative z-10">
        {active ? (
          <>
            <header className="flex items-center justify-between p-4 glass border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${active.color} flex items-center justify-center text-white font-bold`}>
                  {active.name.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm">{active.name}</div>
                  <div className="text-xs text-muted-foreground">{active.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {['Phone','Video','MoreVertical'].map(ic => (
                  <button key={ic} className="w-9 h-9 rounded-xl hover:bg-secondary/60 flex items-center justify-center text-muted-foreground transition-colors">
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-3">
              {active.messages.length === 0 && (
                <div className="flex justify-center">
                  <span className="text-xs text-muted-foreground bg-secondary/40 px-4 py-2 rounded-full">Начало переписки с {active.name}</span>
                </div>
              )}
              {active.messages.map(m => (
                <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[70%] rounded-3xl px-4 py-2.5 ${m.fromMe ? 'brand-gradient text-white rounded-br-lg' : 'glass-strong rounded-bl-lg'}`}>
                    {m.text && <p className="text-sm leading-relaxed">{m.text}</p>}
                    {m.file?.kind === 'image' && (
                      <div className="mt-1 rounded-2xl overflow-hidden w-56">
                        {m.file.url ? <img src={m.file.url} alt={m.file.name} className="w-full object-cover" />
                          : <div className="w-full h-36 bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/40 flex items-center justify-center"><Icon name="Image" size={32} className="text-white/80" /></div>}
                        <div className="text-[11px] mt-1 opacity-80">{m.file.name} · {m.file.size}</div>
                      </div>
                    )}
                    {m.file?.kind === 'doc' && (
                      <div className="mt-1 flex items-center gap-3 min-w-52">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Icon name="FileText" size={20} /></div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.file.name}</div>
                          <div className="text-[11px] opacity-80">{m.file.size}</div>
                        </div>
                        <Icon name="Download" size={18} className="ml-auto opacity-80" />
                      </div>
                    )}
                    <div className={`text-[10px] mt-1 ${m.fromMe ? 'text-white/70' : 'text-muted-foreground'} text-right`}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <footer className="p-4 glass border-t border-border">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                <button onClick={() => fileRef.current?.click()}
                  className="w-11 h-11 rounded-2xl bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <Icon name="Paperclip" size={20} />
                </button>
                <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key==='Enter' && sendText()}
                  placeholder="Написать сообщение..."
                  className="flex-1 bg-secondary/50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground" />
                <button onClick={sendText}
                  className="w-11 h-11 rounded-2xl brand-gradient animate-gradient-move flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform shrink-0">
                  <Icon name="Send" size={18} />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-3xl brand-gradient animate-gradient-move flex items-center justify-center mb-5 animate-float">
              <Icon name="MessageCircle" size={36} className="text-white" />
            </div>
            <h2 className="font-display font-bold text-xl mb-2">Привет, {user.name}!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">Выберите чат или добавьте новый контакт по нику / email</p>
          </div>
        )}
      </main>

      {/* Profile panel */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProfile(false)} />
          <div className="relative w-full max-w-sm glass-strong h-full p-6 animate-scale-in overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display font-bold text-xl">Профиль</h2>
              <button onClick={() => setShowProfile(false)} className="w-9 h-9 rounded-xl hover:bg-secondary/60 flex items-center justify-center"><Icon name="X" size={18} /></button>
            </div>
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-3xl brand-gradient animate-gradient-move flex items-center justify-center text-white text-3xl font-black shadow-xl mb-4">{initials}</div>
              <div className="font-display font-bold text-lg">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <span className="mt-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center gap-1.5">
                <Icon name="Crown" size={13} /> {ROLE_LABEL[user.role] || user.role}
              </span>
            </div>
            <div className="space-y-2">
              {[{icon:'UserCog',label:'Редактировать профиль'},{icon:'Bell',label:'Уведомления'},{icon:'Shield',label:'Конфиденциальность'},{icon:'Palette',label:'Оформление'},{icon:'HelpCircle',label:'Помощь'}].map(item => (
                <button key={item.label} className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-secondary/50 transition-colors text-left">
                  <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center"><Icon name={item.icon} size={18} className="text-muted-foreground" /></div>
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
            <button onClick={onLogout}
              className="w-full mt-6 py-3 rounded-2xl bg-destructive/15 text-destructive font-semibold text-sm flex items-center justify-center gap-2 hover:bg-destructive/25 transition-colors">
              <Icon name="LogOut" size={16} /> Выйти
            </button>
          </div>
        </div>
      )}

      {showAddFriend && <AddFriendModal me={user} onClose={() => setShowAddFriend(false)} onAdded={loadFriends} />}
      {showAdmin && user.role === 'owner' && <AdminPanel me={user} onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  return user ? <Messenger user={user} onLogout={() => setUser(null)} /> : <Login onEnter={setUser} />;
};

export default Index;
