import PageLayout from '../components/PageLayout';
import { NewsIcon } from '../components/icons';

const newsItems = [
  {
    date: '2026-08-04',
    tag: 'раздел',
    title: 'Раздел «Новости» открыт',
    text: 'Здесь будет публиковаться хроника событий, анонсы и записи из жизни семьи.',
  },
  {
    date: '2026-07-28',
    tag: 'запуск',
    title: 'Семейный портал запущен',
    text: 'Главная страница, разделы и статус сервисов уже работают.',
  },
];

function NewsPage() {
  return (
    <PageLayout>
      <section className="page">
        <div className="page__head">
          <span className="page__icon">
            <NewsIcon />
          </span>
          <div>
            <h2>Новости</h2>
            <div className="page__sub">Анонсы, события и хроника семьи</div>
          </div>
        </div>

        {newsItems.length > 0 ? (
          <div className="news-list">
            {newsItems.map((item) => (
              <article className="news-item" key={item.title}>
                <div className="news-item__meta">
                  <span className="news-item__badge">{item.tag}</span>
                  <time dateTime={item.date}>{item.date}</time>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="news-empty">Новостей пока нет — загляните позже.</div>
        )}
      </section>
    </PageLayout>
  );
}

export default NewsPage;
