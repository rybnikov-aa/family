import StatusCard from '../components/StatusCard';
import { useHealth } from '../hooks/useHealth';

function HomePage() {
  const { data, error, loading } = useHealth();

  return (
    <section className="home">
      <h1>Family App</h1>
      <p className="home__subtitle">React + TypeScript frontend</p>

      <div className="status-grid">
        <StatusCard label="Frontend" value="Running" tone="ok" />
        <StatusCard
          label="Backend"
          value={loading ? 'Checking…' : error ?? data?.status ?? 'Unknown'}
          tone={error ? 'error' : 'ok'}
        />
        {data && <StatusCard label="Environment" value={data.environment} />}
      </div>
    </section>
  );
}

export default HomePage;
