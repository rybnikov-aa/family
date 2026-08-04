import SectionCard from '../components/SectionCard';
import StatusCard from '../components/StatusCard';
import ThemeToggle from '../components/ThemeToggle';
import { useHealth } from '../hooks/useHealth';

const stats = [
  { icon: '🏠', value: '2026', label: 'дата регистрации' },
  { icon: '📁', value: '4', label: 'активных раздела' },
  { icon: '⚡', value: '40%', label: 'ремонт', href: '/renovation/' },
];

const sections = [
  {
    icon: '🛠',
    title: 'Ремонт',
    description: 'Техническая документация, фотофиксация, сметы и логи.',
    tag: '→ активный проект',
    href: '/renovation/',
    highlight: true,
  },
  {
    icon: '📋',
    title: 'Дневник',
    description: 'События, даты, маршруты. Хронология семьи.',
    tag: 'архив',
  },
  {
    icon: '📊',
    title: 'Рецепты',
    description: 'Кулинарные алгоритмы и ингредиенты.',
    tag: 'база знаний',
  },
  {
    icon: '🗂',
    title: 'Фотоархив',
    description: 'Снимки, события, люди. Визуальный ряд.',
    tag: 'медиатека',
    href: 'https://immich.rybnikov-aa-home.netcraze.link/',
  },
  {
    icon: '📌',
    title: 'Планы',
    description: 'Цели, задачи, дорожная карта развития.',
    tag: 'стратегия',
  },
];

function HomePage() {
  const { error, loading } = useHealth();

  // Фронтенд считается работоспособным, пока страница отрисована.
  const frontendValue = 'online';
  const frontendTone = 'ok';

  const backendValue = error ? 'офлайн' : loading ? 'проверка…' : 'online';
  const backendTone = error ? 'error' : loading ? 'muted' : 'ok';

  return (
    <div className="container">
      <header className="header">
        <div className="brand">
          <h1>
            <span>•</span>
          </h1>
          <div className="sub">family.rybnikov.su</div>
        </div>
        <div className="header-actions">
          <nav className="nav">
            <a href="#" className="active">
              Главная
            </a>
            <a href="#sections">Разделы</a>
            <a href="/renovation/" className="renov-link">
              Ремонт
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <section className="hero">
        <h2>
          Семейное <strong>цифровое пространство</strong>
        </h2>
        <p> Документация, архивы, фотографии, планы и&nbsp;данные.</p>
      </section>

      <div className="stats">
        {stats.map((stat) => (
          <div className="stat-item" key={stat.label}>
            <span className="icon">{stat.icon}</span>
            <div className="info">
              <span className="value">{stat.value}</span>
              <span className="label">
                {stat.href ? <a href={stat.href}>{stat.label}</a> : stat.label}
              </span>
            </div>
          </div>
        ))}
        <div className="stat-item">
          <span className="icon">📡</span>
          <div className="info">
            <span className="value">{backendValue}</span>
            <span className="label">статус</span>
          </div>
        </div>
      </div>

      <div id="sections" className="grid">
        {sections.map((section) => (
          <SectionCard key={section.title} {...section} />
        ))}
      </div>

      <footer className="footer">
        <span className="copy">© 2026 family.rybnikov.su</span>
        <span className="footer-status">
          <StatusCard label="фронтенд" value={frontendValue} tone={frontendTone} />
          <StatusCard label="бэкенд" value={backendValue} tone={backendTone} />
        </span>
        <span>
          <a href="/renovation/">Ремонт</a>
          <a href="#">Дневник</a>
          <a href="#">Рецепты</a>
          <a href="https://immich.rybnikov-aa-home.netcraze.link/">Архив</a>
        </span>
      </footer>
    </div>
  );
}

export default HomePage;
