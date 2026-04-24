interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return '#3F5D3C'; // moss
  if (score >= 7.0) return '#5C7A58'; // sage-deep
  if (score >= 5.0) return '#E8B84F'; // amber-warn
  return '#C85A44'; // terracotta
}

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  const sizeMap = {
    sm: { dot: 6, text: 'text-[10px]', gap: 'gap-1' },
    md: { dot: 8, text: 'text-xs', gap: 'gap-1.5' },
    lg: { dot: 10, text: 'text-sm font-semibold', gap: 'gap-2' },
  };
  const { dot, text, gap } = sizeMap[size];

  return (
    <span className={`inline-flex items-center ${gap}`}>
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: dot, height: dot, backgroundColor: color }}
      />
      <span className={`${text} font-medium font-mono-num`} style={{ color }}>
        {score.toFixed(1)}
      </span>
    </span>
  );
}
