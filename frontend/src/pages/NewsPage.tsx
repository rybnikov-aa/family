import { useEffect, useState } from 'react';
import PageLayout from '../components/PageLayout';
import NewsAdminModal from '../components/NewsAdminModal';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import { CheckIcon, EditIcon, NewsIcon, PlusIcon, TrashIcon } from '../components/icons';
import { deleteNews, fetchNews, markNewsRead, type NewsPost } from '../api/client';
import { useAuth } from '../hooks/useAuth';

function NewsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setLoading(true);
    void fetchNews(isAdmin)
      .then(setPosts)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить новости'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [isAdmin]);

  const read = async (post: NewsPost) => {
    if (post.read) return;
    await markNewsRead(post.id);
    setPosts((current) =>
      current.map((item) => (item.id === post.id ? { ...item, read: true } : item)),
    );
  };

  const remove = async (post: NewsPost) => {
    if (!window.confirm(`Удалить новость «${post.title}»?`)) return;
    await deleteNews(post.id);
    load();
  };

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
          {isAdmin && (
            <div className="page__head-actions">
              <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>
                Новая новость
              </Button>
            </div>
          )}
        </div>

        {error ? (
          <div className="news-empty">{error}</div>
        ) : loading ? (
          <div className="news-empty">Загрузка новостей…</div>
        ) : posts.length > 0 ? (
          <div className="news-list">
            {posts.map((item) => (
              <article
                className={`news-item${item.pinned ? ' news-item--pinned' : ''}${item.read ? '' : ' news-item--unread'}`}
                key={item.id}
              >
                <div className="news-item__meta">
                  {item.tag && <span className="news-item__badge">{item.tag}</span>}
                  {item.pinned && <span className="news-item__badge">закреплено</span>}
                  <time dateTime={item.publishAt}>
                    {new Date(item.publishAt).toLocaleDateString('ru-RU')}
                  </time>
                  {!item.read && <span className="news-item__badge">новое</span>}
                </div>
                <h3>{item.title}</h3>
                <p className="news-item__text">{item.text}</p>
                {item.attachments.length > 0 && (
                  <div className="news-item__attachments">
                    {item.attachments.map((attachment) => (
                      <a href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id}>
                        <img src={attachment.url} alt={attachment.originalName} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="news-item__actions">
                  {!item.read && (
                    <IconButton
                      label="Отметить прочитанным"
                      tooltip="Отметить прочитанным"
                      size="sm"
                      plain
                      onClick={() => void read(item)}
                    >
                      <CheckIcon />
                    </IconButton>
                  )}
                  {isAdmin && (
                    <IconButton
                      label="Редактировать"
                      tooltip="Редактировать"
                      size="sm"
                      plain
                      onClick={() => setEditing(item)}
                    >
                      <EditIcon />
                    </IconButton>
                  )}
                  {isAdmin && (
                    <IconButton
                      label="Удалить"
                      tooltip="Удалить"
                      size="sm"
                      plain
                      danger
                      onClick={() => void remove(item)}
                    >
                      <TrashIcon />
                    </IconButton>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="news-empty">Новостей пока нет — загляните позже.</div>
        )}
      </section>
      {createOpen && <NewsAdminModal onClose={() => setCreateOpen(false)} onSaved={load} />}
      {editing && <NewsAdminModal post={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </PageLayout>
  );
}

export default NewsPage;
