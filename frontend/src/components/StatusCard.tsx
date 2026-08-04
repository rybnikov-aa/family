interface StatusCardProps {
  label: string;
  value: string;
  tone?: 'ok' | 'error' | 'muted';
}

function StatusCard({ label, value, tone = 'muted' }: StatusCardProps) {
  return (
    <div className={`status-card status-card--${tone}`}>
      <span className="status-card__label">{label}</span>
      <span className="status-card__value">{value}</span>
    </div>
  );
}

export default StatusCard;
