import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { auth } from '../firebase';
import { useData } from '../hooks/data';

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Неверная почта или пароль',
  'auth/invalid-email': 'Некорректная почта',
  'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
  'auth/user-disabled': 'Аккаунт отключён',
};

export default function Login() {
  const { user, isAdmin, authReady } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (!authReady) return null;
  if (user && isAdmin) return <Navigate to="/" replace />;

  if (user && !isAdmin) {
    return (
      <div className="card p-6 max-w-md mx-auto">
        <h1 className="font-display text-xl font-bold mb-2">Нет прав доступа</h1>
        <p className="text-sm text-muted mb-3">
          Вы вошли как <b>{user.email}</b>, но этот аккаунт не добавлен в список администраторов. Владелец проекта должен создать в
          Firestore документ в коллекции <code>admins</code> с таким ID:
        </p>
        <code className="block bg-court-50 rounded-lg p-3 text-sm break-all mb-4 select-all">{user.uid}</code>
        <button className="btn btn-ghost" onClick={() => signOut(auth)}>
          Выйти
        </button>
      </div>
    );
  }

  return (
    <form
      className="card p-6 max-w-sm mx-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (e: unknown) {
          const code = (e as { code?: string }).code ?? '';
          setErr(ERRORS[code] ?? 'Не удалось войти');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="font-display text-xl font-bold mb-1">Вход</h1>
      <p className="text-sm text-muted mb-5">Родителям входить не нужно — всё видно по обычной ссылке.</p>
      <label className="block mb-3">
        <span className="label">Почта</span>
        <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="block mb-4">
        <span className="label">Пароль</span>
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {err && <p className="text-sm text-clay-600 mb-3">{err}</p>}
      {info && <p className="text-sm text-court-600 mb-3">{info}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Вхожу…' : 'Войти'}
      </button>
      <button
        type="button"
        className="mt-3 text-sm text-muted hover:text-ink underline underline-offset-2 w-full"
        onClick={async () => {
          if (!email) {
            setErr('Введите почту, чтобы сбросить пароль');
            return;
          }
          try {
            await sendPasswordResetEmail(auth, email.trim());
            setInfo('Письмо для сброса пароля отправлено');
            setErr('');
          } catch {
            setErr('Не удалось отправить письмо');
          }
        }}
      >
        Забыли пароль?
      </button>
    </form>
  );
}