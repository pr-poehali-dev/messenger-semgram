import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../backend/func2url.json';

const AUTH_URL = (func2url as Record<string, string>).auth;

type User = { id: number; name: string; email: string; role: string };

type Message = {
  id: number;
  fromMe: boolean;
  text?: string;
  time: string;
  file?: { name: string; kind: 'image' | 'doc'; size: string; url?: string };
};

type Chat = {
  id: number;
  name: string;
  role: string;
  avatar: string;
  color: string;
  online: boolean;
  last: string;
  time: string;
  unread: number;
  messages: Message[];
};

const Login = ({ onEnter }: { onEnter: (u: User) => void }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}?action=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка. Попробуйте ещё раз');
        return;
      }
      onEnter(data.user);
    } catch {
      setError('Сервер недоступен. Попробуйте позже');
    } finally {
      setLoading(false);
    }
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
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === m ? 'brand-gradient text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'register' ? 'Регистрация' : 'Вход'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {mode === 'register' && (
            <Field icon="User" placeholder="Имя и фамилия" value={name} onChange={setName} />
          )}
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          Продолжая, вы соглашаетесь с условиями сервиса
        </p>
      </div>
    </div>
  );
};

const Field = ({ icon, placeholder, type = 'text', value, onChange, onEnter }: {
  icon: string; placeholder: string; type?: string; value: string; onChange: (v: string) => void; onEnter?: () => void;
}) => (
  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-secondary/40 border border-border focus-within:border-primary/60 transition-colors">
    <Icon name={icon} size={18} className="text-muted-foreground" />
    <input type={type} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground" />
  </div>
);

const ROLE_LABEL: Record<string, string> = { owner: 'Владелец', admin: 'Администратор', member: 'Участник' };

const Messenger = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = user.name.slice(0, 2).toUpperCase();
  const active = chats.find((c) => c.id === activeId) || null;
  const filtered = chats.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const send = (msg: Message) => {
    if (!activeId) return;
    setChats((prev) => prev.map((c) => c.id === activeId ? { ...c, messages: [...c.messages, msg], last: msg.text || 'Файл', time: msg.time } : c));
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
    send({
      id: Date.now(), fromMe: true, time: 'Сейчас',
      file: {
        name: f.name, kind: isImg ? 'image' : 'doc',
        size: `${(f.size / 1024 / 1024).toFixed(1)} МБ`,
        url: isImg ? URL.createObjectURL(f) : undefined,
      },
    });
    e.target.value = '';
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden relative">
      <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full brand-gradient blur-[140px] opacity-20 pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-full md:w-[380px] flex flex-col glass border-r border-border relative z-10">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl brand-gradient animate-gradient-move flex items-center justify-center">
              <Icon name="Send" size={18} className="text-white" />
            </div>
            <span className="font-display font-black text-xl">sem<span className="text-gradient">Gramm</span></span>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold hover:scale-105 transition-transform">
            {initials}
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border">
            <Icon name="Search" size={16} className="text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск контактов и чатов"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-1">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
              <div className="w-16 h-16 rounded-3xl bg-secondary/60 flex items-center justify-center mb-4">
                <Icon name="MessagesSquare" size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold mb-1">Пока нет чатов</p>
              <p className="text-xs text-muted-foreground">Добавьте контакт, чтобы начать общение</p>
            </div>
          ) : filtered.map((c, i) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all animate-slide-up text-left ${activeId === c.id ? 'glass-strong' : 'hover:bg-secondary/40'}`}>
              <div className="relative shrink-0">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                  <Icon name={c.avatar} size={22} className="text-white" />
                </div>
                {c.online && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-background" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{c.time}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{c.last}</span>
                  {c.unread > 0 && <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full brand-gradient text-white text-[11px] font-bold flex items-center justify-center">{c.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button className="m-4 py-3 rounded-2xl brand-gradient animate-gradient-move text-white font-semibold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
          <Icon name="UserPlus" size={16} /> Добавить контакт
        </button>
      </aside>

      {/* Chat window */}
      <main className="hidden md:flex flex-1 flex-col relative z-10">
        {active ? (
          <>
            <header className="flex items-center justify-between p-4 glass border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${active.color} flex items-center justify-center`}>
                  <Icon name={active.avatar} size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{active.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {active.online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {active.online ? 'В сети' : active.role}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {['Phone', 'Video', 'MoreVertical'].map((ic) => (
                  <button key={ic} className="w-9 h-9 rounded-xl hover:bg-secondary/60 flex items-center justify-center text-muted-foreground transition-colors">
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-3">
              {active.messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[70%] rounded-3xl px-4 py-2.5 ${m.fromMe ? 'brand-gradient text-white rounded-br-lg' : 'glass-strong rounded-bl-lg'}`}>
                    {m.text && <p className="text-sm leading-relaxed">{m.text}</p>}
                    {m.file?.kind === 'image' && (
                      <div className="mt-1 rounded-2xl overflow-hidden w-56">
                        {m.file.url
                          ? <img src={m.file.url} alt={m.file.name} className="w-full object-cover" />
                          : <div className="w-full h-36 bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/40 flex items-center justify-center"><Icon name="Image" size={32} className="text-white/80" /></div>}
                        <div className="text-[11px] mt-1 opacity-80">{m.file.name} · {m.file.size}</div>
                      </div>
                    )}
                    {m.file?.kind === 'doc' && (
                      <div className="mt-1 flex items-center gap-3 min-w-52">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                          <Icon name="FileText" size={20} />
                        </div>
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
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()}
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
            <h2 className="font-display font-bold text-xl mb-2">Добро пожаловать, {user.name}!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Добавьте первый контакт, чтобы начать рабочую переписку в semGramm
            </p>
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
              <button onClick={() => setShowProfile(false)} className="w-9 h-9 rounded-xl hover:bg-secondary/60 flex items-center justify-center">
                <Icon name="X" size={18} />
              </button>
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
              {[
                { icon: 'UserCog', label: 'Редактировать профиль' },
                { icon: 'Bell', label: 'Уведомления' },
                { icon: 'Shield', label: 'Конфиденциальность' },
                { icon: 'Palette', label: 'Оформление' },
                { icon: 'HelpCircle', label: 'Помощь' },
              ].map((item) => (
                <button key={item.label} className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-secondary/50 transition-colors text-left">
                  <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center">
                    <Icon name={item.icon} size={18} className="text-muted-foreground" />
                  </div>
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
    </div>
  );
};

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  return user ? <Messenger user={user} onLogout={() => setUser(null)} /> : <Login onEnter={setUser} />;
};

export default Index;
