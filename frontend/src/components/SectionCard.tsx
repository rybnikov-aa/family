interface SectionCardProps {
  icon: string;
  title: string;
  description: string;
  tag: string;
  href?: string;
  highlight?: boolean;
}

function SectionCard({
  icon,
  title,
  description,
  tag,
  href = '#',
  highlight = false,
}: SectionCardProps) {
  return (
    <a href={href} className={`card${highlight ? ' card-renov' : ''}`}>
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="tag">{tag}</div>
    </a>
  );
}

export default SectionCard;
