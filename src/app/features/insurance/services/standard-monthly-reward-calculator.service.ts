import { Injectable } from '@angular/core';

import { KYOKAI_2024_03_ROWS } from '../data/kyokai-2024-03.rows';
import { PENSION_2024_03_ROWS } from '../data/pension-2024-03.rows';
import { GradeLookupResult } from '../models/standard-monthly-reward-table.model';
import { lookupGrade } from '../utils/grade-lookup.util';

export type StandardMonthlyRewardCalculation = {
    monthlyReward: number;
    health: GradeLookupResult | null;
    pension: GradeLookupResult | null;
};

@Injectable({
    providedIn: 'root',
})
export class StandardMonthlyRewardCalculatorService {
    /**
     * 報酬月額から健康保険（協会けんぽ）・厚生年金の等級/標準報酬月額を算出する。
     * 等級表は令和6年3月分改定（組み込みデータ）を使用。
     */
    calculate(monthlyReward: number): StandardMonthlyRewardCalculation {
        return {
            monthlyReward,
            health: lookupGrade(KYOKAI_2024_03_ROWS, monthlyReward),
            pension: lookupGrade(PENSION_2024_03_ROWS, monthlyReward),
        };
    }
}
