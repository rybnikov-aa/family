import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { fetchSearch, type SearchResult } from '../api/client';
import { SearchIcon } from '../components/icons';

const kindLabels: Record<SearchResult['kind'], string> = {
  project: 'Проекты',
  plan: 'Планы',
  diary: 'Дневник',
};

function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void fetchSearch(query)
      .then((items) => {
        if (active) setResults(items);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Не удалось выполнить поиск');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <PageLayout>
      <section className="page search-page">
        <div className="page__head">
          <span className="page__icon page__icon--plans">
            <SearchIcon />
          </span>
          <div>
            <h2>Поиск</h2>
            <div className="page__sub">Результаты по запросу «{query || '…'}»</div>
          </div>
        </div>
        {query.length < 2 ? (
          <div className="news-empty">Введите минимум 2 символа.</div>
        ) : loading ? (
          <div className="news-empty">Ищем…</div>
        ) : error ? (
          <div className="news-empty">{error}</div>
        ) : results.length === 0 ? (
          <div className="news-empty">Ничего не найдено.</div>
        ) : (
          <div className="search-results">
            {results.map((result) => (
              <Link className="search-result" to={result.url} key={`${result.kind}-${result.id}`}>
                <div className="search-result__head">
                  <strong>{result.title}</strong>
                  <span>{kindLabels[result.kind]}</span>
                </div>
                {result.description && <p>{result.description}</p>}
                {result.meta && <small>{result.meta}</small>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}

export default SearchPage;
