import SectionCard from '../components/SectionCard';
import PageLayout from '../components/PageLayout';
import ServiceStats from '../components/ServiceStats';
import { RenovationIcon, DiaryIcon, NewsIcon, PhotoIcon, PlansIcon } from '../components/icons';
import { ROUTES } from '../routes';
import { useServices } from '../hooks/useServices';

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
  const services = useServices();

  return (
    <PageLayout>
      <section className="hero">
        <h2>
          Семейное <strong>цифровое пространство</strong>
        </h2>
        <p> Документация, архивы, фотографии, планы и&nbsp;данные.</p>
      </section>

      <ServiceStats services={services} />

      <div id="sections" className="grid">
        {sections.map((section) => (
          <SectionCard key={section.title} {...section} />
        ))}
      </div>
    </PageLayout>
  );
}

export default HomePage;
