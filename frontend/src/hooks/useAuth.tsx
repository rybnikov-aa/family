import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
  type AuthUser,
  type ProfileUpdateInput,
} from '../api/client';

interface AuthContextValue {
  /** Текущий пользователь; `null` — не авторизован. */
  user: AuthUser | null;
  /** Идёт ли проверка сессии при старте. */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Обновляет профиль (имя/пароль) и обновляет пользователя в контексте. */
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Провайдер авторизации: при монтировании проверяет сессию (`GET /api/auth/me`),
 * при 401 (событие `auth:unauthorized` от API-клиента) сбрасывает пользователя.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Любой 401 в API — сессия истекла: возвращаемся к экрану входа.
    const onUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('auth:unauthorized', onUnauthorized);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const me = await apiLogin(username, password);
    setUser(me.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* сессия могла уже истечь — неважно, выходим в любом случае */
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    const me = await apiUpdateProfile(input);
    setUser(me.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, updateProfile }),
    [user, loading, login, logout, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Доступ к состоянию авторизации. Использовать внутри `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>');
  return ctx;
}
