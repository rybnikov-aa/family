import SectionCard from '../components/SectionCard';
import PageLayout from '../components/PageLayout';
import { RenovationIcon, DiaryIcon, NewsIcon, PhotoIcon, PlansIcon } from '../components/icons';
import { ROUTES } from '../routes';
import { useHealth } from '../hooks/useHealth';

const stats = [
  { icon: '🏠', value: '2026', label: 'дата регистрации' },
  { icon: '📁', value: '4', label: 'активных раздела' },
  { icon: '⚡', value: '40%', label: 'ремонт', href: '/renovation/' },
];

const sections = [
  {
    icon: RenovationIcon,
    color: '#e8872e',
    title: 'Ремонт',
    description: 'Техническая документация, фотофиксация, сметы и логи.',
    tag: '→ активный проект',
    href: '/renovation/',
    highlight: true,
  },
  {
    icon: DiaryIcon,
    color: '#3b82f6',
    title: 'Дневник',
    description: 'События, даты, маршруты. Хронология семьи.',
    tag: 'архив',
  },
  {
    icon: NewsIcon,
    color: '#14b8a6',
    title: 'Новости',
    description: 'Анонсы, события и хроника семьи.',
    tag: 'лента',
    href: ROUTES.news,
  },
  {
    icon: PhotoIcon,
    color: '#a855f7',
    title: 'Фотоархив',
    description: 'Снимки, события, люди. Визуальный ряд.',
    tag: 'медиатека',
    href: 'https://immich.rybnikov-aa-home.netcraze.link/',
  },
  {
    icon: PlansIcon,
    color: '#ec4899',
    title: 'Планы',
    description: 'Цели, задачи, дорожная карта развития.',
    tag: 'стратегия',
  },
];

function HomePage() {
  const { error, loading } = useHealth();

  const backendValue = error ? 'офлайн' : loading ? 'проверка…' : 'online';

  return (
    <PageLayout>
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
    </PageLayout>
  );
}

export default HomePage;
