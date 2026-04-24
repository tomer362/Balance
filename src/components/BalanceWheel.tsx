import { useEffect, useRef } from 'react';
import type { Profile } from '../store/appStore';
import { sumNutrients } from '../lib/gapAnalysis';

interface BalanceWheelProps {
  profile: Profile;
  size?: number;
}

// SVG arc helpers
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const clampedEnd = endDeg - startDeg >= 360 ? startDeg + 359.99 : endDeg;
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, clampedEnd);
  const large = clampedEnd - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

interface RingProps {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  pct: number;
  color: string;
  trackColor?: string;
  animate?: boolean;
  id: string;
}

function Ring({ cx, cy, r, strokeWidth, pct, color, trackColor = '#EFE4D2', animate = true, id }: RingProps) {
  const clampedPct = Math.min(pct, 1.2); // allow up to 120%
  const endDeg = clampedPct * 360;
  const shouldPulse = pct < 0.7 && pct > 0;

  return (
    <g>
      {/* Track */}
      <path
        d={describeArc(cx, cy, r, 0, 359.99)}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Fill */}
      {pct > 0 && (
        <path
          id={id}
          d={describeArc(cx, cy, r, 0, endDeg)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={shouldPulse ? 'pulse-slow' : ''}
          style={{
            filter: pct >= 1.0 ? `drop-shadow(0 0 3px ${color}66)` : undefined,
          }}
        />
      )}
    </g>
  );
}

function GLCenter({ cx, cy, r, gl, maxGL }: { cx: number; cy: number; r: number; gl: number; maxGL: number }) {
  const pct = gl / maxGL;
  let color = '#3F5D3C'; // moss = good
  if (pct > 0.9) color = '#C85A44'; // terracotta
  else if (pct > 0.7) color = '#E8B84F'; // amber

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.15} />
      <circle cx={cx} cy={cy} r={r * 0.65} fill={color} opacity={0.3} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={10} fontFamily="JetBrains Mono, monospace" fill={color} fontWeight="600">
        {Math.round(gl)}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={7} fontFamily="Inter, sans-serif" fill={color} opacity={0.8}>
        GL
      </text>
    </g>
  );
}

function ProteinDots({ cx, cy, r, mealsWithProtein, total }: { cx: number; cy: number; r: number; mealsWithProtein: number[]; total: number }) {
  const dots = Array.from({ length: total }, (_, i) => {
    const angle = (360 / total) * i - 90;
    const rad = (angle * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const proteinForMeal = mealsWithProtein[i] ?? 0;
    const color = proteinForMeal >= 25 ? '#3F5D3C' : proteinForMeal >= 15 ? '#E8B84F' : '#EFE4D2';
    return { x, y, color };
  });

  return (
    <g>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={5} fill={d.color} />
      ))}
    </g>
  );
}

export default function BalanceWheel({ profile, size = 280 }: BalanceWheelProps) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = profile.foodLog.filter((m) => m.timestamp.startsWith(today));
  const totals = sumNutrients(todayMeals.map((m) => m.nutrition));
  const targets = profile.targets;

  const cx = size / 2;
  const cy = size / 2;
  const strokeW = Math.round(size * 0.065);
  const gap = strokeW + 4;

  // Ring radii (outermost first)
  const r1 = cx - strokeW / 2 - 6;
  const r2 = r1 - gap;
  const r3 = r2 - gap;
  const r4 = r3 - gap;
  const centerR = r4 - gap - 4;

  const isPCOS = profile.mode === 'pcos';

  // Percentages
  const calTarget = isPCOS ? targets.calories : (targets.calories_training_day ?? targets.calories);
  const calPct = totals.calories / calTarget;
  const protPct = totals.protein_g / targets.protein_g;
  const fiberPct = targets.fiber_g ? totals.fiber_g / targets.fiber_g : 0;
  const omega3Pct = targets.omega3_g ? (totals.omega3_g ?? 0) / targets.omega3_g : 0;
  const carbPct = targets.carbs_g ? totals.carbs_g / targets.carbs_g : 0;
  const fatPct = targets.fat_g ? totals.fat_g / targets.fat_g : 0;

  // Calorie color
  let calColor = '#8FA989'; // sage-primary
  if (isPCOS) {
    if (calPct > 1.1) calColor = '#C85A44';
    else if (calPct > 1.0) calColor = '#E8B84F';
  } else {
    if (calPct > 1.15) calColor = '#C85A44';
    else if (calPct < 0.9) calColor = '#E8B84F'; // under-eating is bad in bulk
  }

  // Protein color
  const protColor = protPct >= 1.0 ? '#3F5D3C' : '#E8876A';

  // Today's meals protein per meal for Bulk dots
  const mealsProteins = todayMeals
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((m) => m.nutrition.protein_g);

  const remaining = Math.max(0, calTarget - totals.calories);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Ring 1: Calories */}
        <Ring cx={cx} cy={cy} r={r1} strokeWidth={strokeW} pct={calPct} color={calColor} id="r-cal" />

        {/* Ring 2: Protein */}
        <Ring cx={cx} cy={cy} r={r2} strokeWidth={strokeW} pct={protPct} color={protColor} id="r-prot" />

        {/* Ring 3: Fiber (PCOS) or Carbs (Bulk) */}
        <Ring
          cx={cx} cy={cy} r={r3} strokeWidth={strokeW}
          pct={isPCOS ? fiberPct : carbPct}
          color={isPCOS ? '#3F5D3C' : '#D97706'}
          id="r3"
        />

        {/* Ring 4: Omega-3 (PCOS) or Fat (Bulk) */}
        <Ring
          cx={cx} cy={cy} r={r4} strokeWidth={strokeW}
          pct={isPCOS ? omega3Pct : fatPct}
          color={isPCOS ? '#3B82F6' : '#B45309'}
          id="r4"
        />

        {/* Center */}
        {isPCOS ? (
          <GLCenter
            cx={cx} cy={cy} r={centerR}
            gl={totals.glycemic_load ?? 0}
            maxGL={targets.max_glycemic_load ?? 100}
          />
        ) : (
          <ProteinDots
            cx={cx} cy={cy} r={centerR}
            mealsWithProtein={mealsProteins}
            total={targets.meals_per_day_target ?? 5}
          />
        )}
      </svg>

      {/* Calorie readout */}
      <div className="text-center -mt-2">
        <div className="font-display text-3xl font-semibold text-plum-dark tracking-tight">
          {Math.round(totals.calories).toLocaleString()}
          <span className="text-lg text-ink-40 font-normal"> / {calTarget.toLocaleString()}</span>
        </div>
        <div className="text-sm text-ink-60 mt-0.5">
          {remaining > 0
            ? <><span className="font-medium text-plum-dark">{Math.round(remaining).toLocaleString()} kcal</span> remaining</>
            : <span className="text-terracotta font-medium">Daily target reached</span>
          }
        </div>
      </div>

      {/* Ring legend */}
      <div className="flex gap-3 mt-3 flex-wrap justify-center">
        {[
          { label: 'Calories', color: calColor },
          { label: 'Protein', color: protColor },
          { label: isPCOS ? 'Fiber' : 'Carbs', color: isPCOS ? '#3F5D3C' : '#D97706' },
          { label: isPCOS ? 'Omega-3' : 'Fat', color: isPCOS ? '#3B82F6' : '#B45309' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1 text-xs text-ink-60">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
