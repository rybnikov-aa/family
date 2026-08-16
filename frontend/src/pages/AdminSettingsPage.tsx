import { useEffect, useState, type FormEvent } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import { CheckIcon, CrossIcon } from '../components/icons';
import { checkImmichSettings, fetchImmichSettings } from '../api/client';

/**
 * Админ-страница «Настройки»: подключение к инстансу Immich (фотоархив).
 * Поля: адрес инстанса, API-ключ и кнопка «Проверить соединение».
 * При успехе бэкенд сохраняет реквизиты в БД и возвращает версию сервера —
 * возле адреса появляется зелёная галочка; при ошибке БД не меняется
 * и возле адреса — красный крест. Ключ никогда не возвращается с сервера:
 * если он уже задан, форма показывает placeholder, пустое поле = оставить
 * прежний ключ. Доступна только роли `admin` (гейт `AdminGate`).
 */
function AdminSettingsPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Результат последней проверки и адрес, для которого он получен
  // (индикатор возле адреса скрывается, если адрес изменили после проверки).
  const [status, setStatus] = useState<'ok' | 'error' | null>(null);
  const [checkedBaseUrl, setCheckedBaseUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchImmichSettings()
      .then((settings) => {
        if (!mounted) return;
        setBaseUrl(settings.baseUrl ?? '');
        setApiKeyConfigured(settings.apiKeyConfigured);
      })
      .catch((err: unknown) => {
        if (mounted) {
          setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить настройки');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    setMessage(null);
    const address = baseUrl.trim();
    try {
      const result = await checkImmichSettings(address, apiKey.trim());
      setCheckedBaseUrl(address);
      if (result.ok) {
        setStatus('ok');
        if (apiKey.trim()) setApiKeyConfigured(true);
        const v = result.version;
        setMessage(
          v
            ? `Подключение установлено (версия сервера ${v.major}.${v.minor}.${v.patch})`
            : 'Подключение установлено',
        );
        setApiKey('');
      } else {
        setStatus('error');
        setMessage(result.error ?? 'Не удалось подключиться к Immich');
      }
    } catch (err) {
      setStatus('error');
      setCheckedBaseUrl(address);
      setMessage(err instanceof Error ? err.message : 'Не удалось подключиться к Immich');
    } finally {
      setChecking(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleCheck();
  };

  // Индикатор возле адреса: галочка/крест только если адрес не менялся после проверки.
  const indicator =
    status !== null && checkedBaseUrl === baseUrl.trim() ? (
      status === 'ok' ? (
        <span
          className="immich-settings__status immich-settings__status--ok"
          role="status"
          title="Соединение установлено"
        >
          <CheckIcon width="1.1rem" height="1.1rem" />
        </span>
      ) : (
        <span
          className="immich-settings__status immich-settings__status--error"
          role="alert"
          title="Ошибка соединения"
        >
          <CrossIcon width="1.1rem" height="1.1rem" />
        </span>
      )
    ) : null;

  return (
    <PageLayout>
      <section className="admin">
        <div className="admin__head">
          <div>
            <h2 className="admin__title">Настройки</h2>
            <p className="admin__sub">Подключение к инстансу Immich (фотоархив)</p>
          </div>
        </div>

        {loadError && (
          <div className="alert alert--error" role="alert">
            {loadError}
          </div>
        )}

        <div className="admin__card">
          {loading ? (
            <p className="admin__empty">Загрузка…</p>
          ) : (
            <form className="immich-settings" onSubmit={onSubmit}>
              <label className="field field--block">
                <span className="field__label">Адрес инстанса</span>
                <div className="immich-settings__input">
                  <input
                    className="input"
                    type="text"
                    placeholder="https://photos.example.com"
                    autoComplete="off"
                    spellCheck={false}
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                  {indicator}
                </div>
                <span className="field__hint">
                  Суффикс /api добавится автоматически, если не указан
                </span>
              </label>

              <label className="field field--block">
                <span className="field__label">API-ключ</span>
                <input
                  className="input"
                  type="password"
                  placeholder={
                    apiKeyConfigured
                      ? 'Ключ задан — оставьте пустым, чтобы сохранить прежний'
                      : 'API-ключ пользователя Immich'
                  }
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                {apiKeyConfigured && (
                  <span className="field__hint">API-ключ сохранён в базе и не отображается</span>
                )}
              </label>

              {message && (
                <div
                  className={`alert alert--block ${status === 'ok' ? 'alert--success' : 'alert--error'}`}
                  role={status === 'ok' ? 'status' : 'alert'}
                >
                  {message}
                </div>
              )}

              <Button type="submit" variant="primary" disabled={checking || !baseUrl.trim()}>
                {checking ? 'Проверка…' : 'Проверить соединение'}
              </Button>
            </form>
          )}
        </div>
      </section>
    </PageLayout>
  );
}

export default AdminSettingsPage;
