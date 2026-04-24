import type { Gap } from '../lib/gapAnalysis';

interface GapIndicatorProps {
  gaps: Gap[];
  compact?: boolean;
}

function severityColor(severity: Gap['severity']): { bg: string; text: string; dot: string } {
  switch (severity) {
    case 'high':
      return { bg: 'bg-terracotta/10', text: 'text-terracotta', dot: 'bg-terracotta' };
    case 'medium':
      return { bg: 'bg-amber-warn/15', text: 'text-amber-600', dot: 'bg-amber-warn' };
    case 'warning':
      return { bg: 'bg-sand', text: 'text-ink-60', dot: 'bg-ink-40' };
    default:
      return { bg: 'bg-sand', text: 'text-ink-40', dot: 'bg-ink-40' };
  }
}

export default function GapIndicator({ gaps, compact = false }: GapIndicatorProps) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 text-moss text-sm">
        <span className="w-2 h-2 rounded-full bg-moss inline-block" />
        <span>All targets on track</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {gaps.slice(0, compact ? 3 : gaps.length).map((gap) => {
        const colors = severityColor(gap.severity);
        return (
          <span
            key={gap.nutrient}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
            {gap.label}
          </span>
        );
      })}
    </div>
  );
}
