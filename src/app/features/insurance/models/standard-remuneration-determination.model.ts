import { StandardMonthlyRewardCalculation } from '../services/standard-monthly-reward-calculator.service';

export type DeterminationType = 'initial' | 'regular' | 'revision';

export type EffectiveStandardRemuneration = {
    determinationType: DeterminationType;
    determinationLabel: string;
    description: string;
    qualificationYearMonth: string | null;
    calculationMonths: string[];
    averageMonthlyReward: number | null;
    calculation: StandardMonthlyRewardCalculation | null;
    isComplete: boolean;
    missingMonths: string[];
};
