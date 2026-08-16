import { useMemo, useState } from 'react';
import SectionCard from '../components/SectionCard';
import PageLayout from '../components/PageLayout';
import ServiceStats from '../components/ServiceStats';
import VpsDetailsModal from '../components/VpsDetailsModal';
import { DiaryIcon, NewsIcon, PhotoIcon, PlansIcon, ProjectsIcon } from '../components/icons';
import { ROUTES } from '../routes';
import { useServices } from '../hooks/useServices';
import { useImmichSettings } from '../hooks/useImmichSettings';

// Разделы главной без «Фотоархива»: его адрес берётся из настроек Immich
// (см. `useImmichSettings`) и добавляется динамически, если инстанс настроен.
const sections = [
  {
    icon: NewsIcon,
    color: '#14b8a6',
    title: 'Новости',
    description: 'Анонсы, события и хроника семьи.',
    tag: 'лента',
    href: ROUTES.news,
  },
  {
    icon: DiaryIcon,
    color: '#3b82f6',
    title: 'Дневник',
    description: 'События, даты, маршруты. Хронология семьи.',
    tag: 'архив',
    href: ROUTES.diary,
  },
  {
    icon: ProjectsIcon,
    color: '#0ea5e9',
    title: 'Проекты',
    description: 'Отдельные подпроекты: документация, отчёты и архивы.',
    tag: 'каталог',
    href: ROUTES.projects,
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
  const { services, vps, loading, refresh } = useServices();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const immichUrl = useImmichSettings();

  // Карточка «Фотоархив» рендерится, только если в настройках задан адрес Immich.
  const photoSection = immichUrl
    ? [
        {
          icon: PhotoIcon,
          color: '#a855f7',
          title: 'Фотоархив',
          description: 'Снимки, события, люди. Визуальный ряд.',
          tag: 'медиатека',
          href: immichUrl,
        },
      ]
    : [];

  // Карточка VPS открывает модалку с детализацией доступности.
  const items = useMemo(
    () =>
      services.map((service) =>
        service.id === 'vps' ? { ...service, onClick: () => setDetailsOpen(true) } : service,
      ),
    [services],
  );

  return (
    <PageLayout>
      <section className="hero">
        <h2>
          Семейное <strong>цифровое пространство</strong>
        </h2>
        <p> Документация, архивы, фотографии, планы и&nbsp;данные.</p>
      </section>

      <ServiceStats services={items} onRefresh={refresh} refreshing={loading} />

      <div id="sections" className="grid">
        {[...sections.slice(0, 2), ...photoSection, ...sections.slice(2)].map((section) => (
          <SectionCard key={section.title} {...section} />
        ))}
      </div>

      {detailsOpen && (
        <VpsDetailsModal
          statuses={vps}
          onClose={() => setDetailsOpen(false)}
          onRefresh={refresh}
          refreshing={loading}
        />
      )}
    </PageLayout>
  );
}

export default HomePage;
