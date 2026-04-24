import type { Phase, Profile } from '../store/appStore';

export { Phase };

export interface PhaseInfo {
  phase: Phase;
  dayInPhase: number;
  confidence: 'high' | 'medium' | 'low';
  cycleDay: number;
  daysUntilNextPeriod: number;
}

/**
 * Three-layer fallback system:
 * 1. Manual override (highest priority)
 * 2. 3+ cycles → compute rolling average cycle length
 * 3. Fewer than 3 cycles → 28-day default with 'low' confidence
 */
export function getCurrentPhase(profile: Profile): PhaseInfo {
  const cycle = profile.pcos?.cycle;
  if (!cycle) {
    return {
      phase: 'follicular',
      dayInPhase: 1,
      confidence: 'low',
      cycleDay: 1,
      daysUntilNextPeriod: 14,
    };
  }

  // Layer 1: Manual override
  if (cycle.currentPhaseOverride) {
    return {
      phase: cycle.currentPhaseOverride,
      dayInPhase: 1,
      confidence: 'high',
      cycleDay: 1,
      daysUntilNextPeriod: 14,
    };
  }

  // Find the most recent period start
  const sortedHistory = [...cycle.history].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
  );

  const lastPeriod = sortedHistory[0];
  if (!lastPeriod) {
    return {
      phase: 'follicular',
      dayInPhase: 1,
      confidence: 'low',
      cycleDay: 1,
      daysUntilNextPeriod: 14,
    };
  }

  // Layer 2 vs 3: determine cycle length
  let avgCycleLength = cycle.avgCycleLength ?? 28;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (sortedHistory.length >= 3) {
    // Rolling average from last 3+ cycles
    const completedCycles = sortedHistory.filter((h) => h.end);
    if (completedCycles.length >= 2) {
      const lengths: number[] = [];
      for (let i = 0; i < Math.min(completedCycles.length - 1, 3); i++) {
        const start1 = new Date(sortedHistory[i].start).getTime();
        const start2 = new Date(sortedHistory[i + 1].start).getTime();
        const diffDays = (start1 - start2) / (1000 * 60 * 60 * 24);
        if (diffDays > 0 && diffDays < 60) lengths.push(diffDays);
      }
      if (lengths.length > 0) {
        avgCycleLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
        confidence = 'high';
      }
    } else {
      confidence = 'medium';
    }
  } else if (sortedHistory.length >= 1) {
    confidence = 'medium';
  }

  const periodLength = cycle.avgPeriodLength ?? 5;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastStart = new Date(lastPeriod.start);
  lastStart.setHours(0, 0, 0, 0);

  const daysSincePeriodStart = Math.floor(
    (today.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Cycle day (1-indexed)
  const cycleDay = (daysSincePeriodStart % avgCycleLength) + 1;

  // Determine phase boundaries
  // Menstrual: days 1-periodLength
  // Follicular: days periodLength+1 to ~(cycleLength * 0.35)
  // Ovulatory: ~days (cycleLength * 0.35) to (cycleLength * 0.5)
  // Luteal: ~days (cycleLength * 0.5) to cycleLength
  const follicularStart = periodLength + 1;
  const ovulatoryStart = Math.round(avgCycleLength * 0.35);
  const lutealStart = Math.round(avgCycleLength * 0.5);

  let phase: Phase;
  let dayInPhase: number;

  if (cycleDay <= periodLength) {
    phase = 'menstrual';
    dayInPhase = cycleDay;
  } else if (cycleDay < ovulatoryStart) {
    phase = 'follicular';
    dayInPhase = cycleDay - follicularStart + 1;
  } else if (cycleDay < lutealStart) {
    phase = 'ovulatory';
    dayInPhase = cycleDay - ovulatoryStart + 1;
  } else {
    phase = 'luteal';
    dayInPhase = cycleDay - lutealStart + 1;
  }

  const daysUntilNextPeriod = avgCycleLength - cycleDay + 1;

  return { phase, dayInPhase, confidence, cycleDay, daysUntilNextPeriod };
}

export function getPhaseColor(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return '#C85A44'; // terracotta
    case 'follicular':
      return '#8FA989'; // sage-primary
    case 'ovulatory':
      return '#5C7A58'; // sage-deep
    case 'luteal':
      return '#E8B84F'; // amber-warn
    default:
      return '#8F7F90';
  }
}

export function getPhaseName(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return 'Menstrual Phase';
    case 'follicular':
      return 'Follicular Phase';
    case 'ovulatory':
      return 'Ovulatory Phase';
    case 'luteal':
      return 'Luteal Phase';
    default:
      return 'Unknown Phase';
  }
}

export interface PhaseNutritionBrief {
  priorities: string[];
  limits: string[];
  calorieAdjustment: number;
  seedCycling?: string;
}

export function getPhaseNutritionBrief(phase: Phase): PhaseNutritionBrief {
  switch (phase) {
    case 'menstrual':
      return {
        priorities: ['Iron-rich foods', 'Anti-inflammatory omega-3', 'Magnesium sources', 'Vitamin C (enhances iron absorption)'],
        limits: ['Caffeine', 'Alcohol', 'Excess sodium (bloating)'],
        calorieAdjustment: 0,
        seedCycling: 'Flaxseeds + Pumpkin seeds (1 tbsp each daily)',
      };
    case 'follicular':
      return {
        priorities: ['High protein for building', 'Fermented foods (gut health)', 'Zinc sources', 'B vitamins'],
        limits: ['Heavy meals', 'Excess fat'],
        calorieAdjustment: 0,
        seedCycling: 'Flaxseeds + Pumpkin seeds (1 tbsp each daily)',
      };
    case 'ovulatory':
      return {
        priorities: ['Antioxidants', 'Cruciferous vegetables', 'Fiber-rich foods', 'Glutathione boosters'],
        limits: ['Excess estrogen foods', 'Processed foods'],
        calorieAdjustment: 50,
        seedCycling: 'Sesame seeds + Sunflower seeds (1 tbsp each daily)',
      };
    case 'luteal':
      return {
        priorities: ['Complex carbohydrates', 'Magnesium (dark chocolate, nuts)', 'Vitamin B6', 'Calcium-rich foods'],
        limits: ['High-GL foods', 'Excess sugar', 'Caffeine'],
        calorieAdjustment: 100,
        seedCycling: 'Sesame seeds + Sunflower seeds (1 tbsp each daily)',
      };
    default:
      return {
        priorities: [],
        limits: [],
        calorieAdjustment: 0,
      };
  }
}
