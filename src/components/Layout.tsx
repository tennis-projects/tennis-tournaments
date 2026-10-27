import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { Link, NavLink, Outlet } from 'react-router';
import { auth, firebaseConfigured } from '../firebase';
import { useData } from '../hooks/data';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
    isActive ? 'bg-ball text-court-900' : 'text-court-100 hover:text-white'
  }`;

export default function Layout() {
  const { user, isAdmin, role, error, loading } = useData();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-court-700 text-white">
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/" className="flex items-center gap-2 mr-auto">
            <span className="w-8 h-8 rounded-full bg-ball grid place-items-center text-court-900 text-lg">●</span>
            <span className="font-display font-bold text-lg tracking-tight">Турниры</span>
          </Link>
          <div className="text-xs order-2 sm:order-3 flex items-center gap-2">
            {user ? (
              <>
                {isAdmin && <span className="rounded-full bg-clay-500 px-2 py-0.5 font-semibold">{role === 'coach' ? 'тренер' : 'админ'}</span>}
                <button className="text-court-100 hover:text-white underline underline-offset-2" onClick={() => signOut(auth)}>
                  Выйти
                </button>
              </>
            ) : (
              <Link to="/login" className="text-court-100 hover:text-white underline underline-offset-2">
                Вход
              </Link>
            )}
          </div>
          <nav className="flex gap-1 order-3 sm:order-2 w-full sm:w-auto -mx-1">
            <NavLink to="/" end className={navCls}>
              Турниры
            </NavLink>
            <NavLink to="/rating" className={navCls}>
              Рейтинг
            </NavLink>
            <NavLink to="/players" className={navCls}>
              Игроки
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {!firebaseConfigured && (
          <Notice tone="warn">
            Firebase не подключён. Создайте файл <code>.env.local</code> по образцу <code>.env.example</code> и перезапустите
            <code> npm run dev</code>. Подробности в README.
          </Notice>
        )}
        {error && <Notice tone="warn">Ошибка базы данных: {error}</Notice>}
        {loading ? <p className="text-muted py-10 text-center">Загрузка…</p> : <Outlet />}
      </main>

      <footer className="text-center text-xs text-muted py-6">Результаты обновляются автоматически</footer>
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3 text-sm ${
        tone === 'warn' ? 'bg-clay-100 text-clay-600' : 'bg-court-50 text-court-700'
      }`}
    >
      {children}
    </div>
  );
}