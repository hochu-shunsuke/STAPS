export interface WorkerParams {
    age: number;
    basicPension: number; // 老齢基礎年金（年額） - 支給停止の対象外
    employeePension: number; // 老齢厚生年金（年額） - 在職老齢年金の支給停止対象
    hourlyWage: number;
}

export interface SimulationResult {
    weeklyHours: number;
    monthlyGrossWage: number;
    monthlyPension: number;
    reductionAmount: number; // 年金停止額
    socialInsuranceDeduction: number; // 社会保険料控除
    incomeTaxDeduction: number; // ざっくりとした所得税
    monthlyNetIncome: number; // 最終的な手取り月額
}

export function simulateNetIncome(params: WorkerParams): SimulationResult[] {
    const results: SimulationResult[] = [];
    const WEEKS_PER_MONTH = 4.33; // 1ヶ月あたりの週数

    const monthlyBasicPension = params.basicPension / 12;
    const monthlyEmployeePension = params.employeePension / 12;
    const totalMonthlyPension = monthlyBasicPension + monthlyEmployeePension;

    for (let hours = 0; hours <= 40; hours++) {
        const monthlyGrossWage = hours * params.hourlyWage * WEEKS_PER_MONTH;
        const yearlyGrossWage = monthlyGrossWage * 12;

        // 1. 在職老齢年金の計算（2026年基準: 65万円）
        // ※老齢基礎年金は停止対象外。老齢厚生年金（報酬比例部分）のみ対象。
        let reductionAmount = 0;
        if (monthlyGrossWage + monthlyEmployeePension > 650_000) {
            reductionAmount = ((monthlyGrossWage + monthlyEmployeePension) - 650_000) / 2;
            if (reductionAmount > monthlyEmployeePension) {
                reductionAmount = monthlyEmployeePension; // 停止額の上限は老齢厚生年金額
            }
        }

        const actualMonthlyPension = totalMonthlyPension - reductionAmount;

        // 2. 社会保険料控除の計算 (2026年基準)
        // 年収や企業規模要件が原則撤廃され、「週20時間以上」であれば原則加入対象となる想定
        let isEnrolledInShaho = false;
        if (hours >= 20) {
            isEnrolledInShaho = true;
        } else if (yearlyGrossWage >= 1_300_000) {
            // 20時間未満でも年収130万を超えれば配偶者等の扶養を外れるため、
            // 便宜上ご自身の給与から国保・国民年金等が同等引かれると仮定
            isEnrolledInShaho = true;
        }

        let socialInsuranceRate = 0;
        if (isEnrolledInShaho) {
            if (params.age < 70) {
                socialInsuranceRate = 0.1415; // 厚生年金(~9.15%) + 健康保険(~5%)
            } else if (params.age < 75) {
                socialInsuranceRate = 0.05; // 70歳以上は厚生年金加入義務なし。健康保険のみ。
            }
        }

        // 雇用保険（週20時間以上で加入。年齢問わず従業員負担は約0.6%）
        let employmentInsuranceRate = 0;
        if (hours >= 20) {
            employmentInsuranceRate = 0.006;
        }

        const socialInsuranceDeduction = monthlyGrossWage * (socialInsuranceRate + employmentInsuranceRate);

        // 3. 所得税の計算 (2026年基準予定)
        // 103万の壁が160万等に引き上げられる想定（月額約133,333円の非課税枠）
        let incomeTaxDeduction = 0;
        const taxableIncome = Math.max(0, monthlyGrossWage - socialInsuranceDeduction - 133_333);
        if (taxableIncome > 0) {
            // かなり簡易的な源泉徴収税額計算
            incomeTaxDeduction = taxableIncome * 0.05105; // 復興特別所得税含む
        }

        // 最終手取り額
        const monthlyNetIncome = (monthlyGrossWage - socialInsuranceDeduction - incomeTaxDeduction) + actualMonthlyPension;

        results.push({
            weeklyHours: hours,
            monthlyGrossWage: Math.round(monthlyGrossWage),
            monthlyPension: Math.round(actualMonthlyPension),
            reductionAmount: Math.round(reductionAmount),
            socialInsuranceDeduction: Math.round(socialInsuranceDeduction),
            incomeTaxDeduction: Math.round(incomeTaxDeduction),
            monthlyNetIncome: Math.round(monthlyNetIncome),
        });
    }

    return results;
}
