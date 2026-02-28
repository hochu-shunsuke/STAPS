export interface WorkerParams {
    id?: string;
    age: number;
    basicPension: number; // 老齢基礎年金（年額） - 支給停止の対象外
    employeePension: number; // 老齢厚生年金（年額） - 在職老齢年金の支給停止対象
    hourlyWage: number;
    // 書類からの抽出データ
    payslip?: {
        baseSalary: number;
        socialInsurance: number;
        incomeTax: number;
        residentTax: number;
        netIncome: number;
    };
    pensionNotice?: {
        monthlyPension: number;
        suspendedAmount: number;
    };
    continuedBenefitsNotice?: {
        paymentAmount: number;
        paymentRate: number;
    };
    residentTaxNotice?: {
        monthlySpecialCollection: number;
    };
}

export interface SimulationResult {
    weeklyHours: number;
    monthlyGrossWage: number;
    monthlyPension: number;
    reductionAmount: number; // 年金停止額
    socialInsuranceDeduction: number; // 社会保険料控除
    incomeTaxDeduction: number; // 所得税
    residentTaxDeduction: number; // 住民税
    employmentContinuationBenefit: number; // 高年齢雇用継続給付金
    monthlyNetIncome: number; // 最終的な手取り月額
    realHourlyWage: number; // 実質時給 (直前の時間からの増分)
}

// 簡易的な標準報酬月額の等級表 (2024年基準の一部抜粋)
// 実際の50等級ではなく、崖を可視化するための代表的な区切り
function calculateStandardRemuneration(wage: number): number {
    if (wage < 63000) return 58000;
    if (wage < 73000) return 68000;
    if (wage < 83000) return 78000;
    if (wage < 93000) return 88000;
    if (wage < 101000) return 98000;
    if (wage < 107000) return 104000;
    if (wage < 114000) return 110000;
    if (wage < 122000) return 118000;
    if (wage < 130000) return 126000;
    if (wage < 138000) return 134000;
    if (wage < 146000) return 142000;
    if (wage < 155000) return 150000;
    if (wage < 165000) return 160000;
    if (wage < 175000) return 170000;
    if (wage < 185000) return 180000;
    if (wage < 195000) return 190000;
    if (wage < 210000) return 200000;
    if (wage < 230000) return 220000;
    if (wage < 250000) return 240000;
    if (wage < 270000) return 260000;
    if (wage < 290000) return 280000;
    if (wage < 310000) return 300000;
    return wage; // それ以上は単純比例として扱う（MVPとしての簡略化）
}

export function simulateNetIncome(params: WorkerParams): SimulationResult[] {
    const results: SimulationResult[] = [];
    const WEEKS_PER_MONTH = 4.33; // 1ヶ月あたりの週数

    const monthlyBasicPension = params.basicPension / 12;
    const monthlyEmployeePension = params.employeePension / 12;
    const totalMonthlyPension = monthlyBasicPension + monthlyEmployeePension;

    // 高年齢雇用継続給付金の60歳時賃金（みなし）を逆算
    let assumedAge60Wage = 0;
    if (params.continuedBenefitsNotice) {
        // 現在の支給率が15%の場合、現在の給与は60歳時の61%以下だったと推測される
        // ざっくりと (支給額 / 0.15) / 0.61 = 60歳時賃金 とおく
        if (params.continuedBenefitsNotice.paymentRate === 15) {
            assumedAge60Wage = (params.continuedBenefitsNotice.paymentAmount / 0.15) / 0.61;
        } else {
            // 中間率の場合の複雑な逆算は省略し、現在給与から近似
            assumedAge60Wage = (params.continuedBenefitsNotice.paymentAmount / (params.continuedBenefitsNotice.paymentRate / 100)) / 0.7;
        }
    }

    // 住民税の固定控除
    const residentTaxDeduction = params.residentTaxNotice?.monthlySpecialCollection || 0;

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

        // 2. 高年齢雇用継続給付金の計算
        let employmentContinuationBenefit = 0;
        if (assumedAge60Wage > 0 && params.age >= 60 && params.age < 65) {
            const wageRatio = monthlyGrossWage / assumedAge60Wage;
            if (wageRatio < 0.61) {
                employmentContinuationBenefit = monthlyGrossWage * 0.15;
            } else if (wageRatio < 0.75) {
                // 61%〜75%にかけて15%から0%に逓減する複雑な計算式（概算）
                const decreaseRate = (0.75 - wageRatio) / (0.75 - 0.61) * 0.15;
                employmentContinuationBenefit = monthlyGrossWage * decreaseRate;
            }
            // 75%以上は支給停止（大きな崖）
        }

        // 3. 社会保険料控除の計算 (2026年基準)
        // 年収や企業規模要件が原則撤廃され、「週20時間以上」であれば原則加入対象となる想定
        let isEnrolledInShaho = false;
        if (hours >= 20) {
            isEnrolledInShaho = true;
        } else if (yearlyGrossWage >= 1_300_000) {
            isEnrolledInShaho = true;
        }

        let standardRemuneration = isEnrolledInShaho ? calculateStandardRemuneration(monthlyGrossWage) : 0;
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

        const socialInsuranceDeduction = (standardRemuneration * socialInsuranceRate) + (monthlyGrossWage * employmentInsuranceRate);

        // 4. 所得税の計算 (2026年基準予定)
        // 103万の壁が160万等に引き上げられる想定（月額約133,333円の非課税枠）
        let incomeTaxDeduction = 0;
        const taxableIncome = Math.max(0, monthlyGrossWage - socialInsuranceDeduction - 133_333);
        if (taxableIncome > 0) {
            // 源泉徴収税額表に基づく概算
            incomeTaxDeduction = taxableIncome * 0.05105;
        }

        // 最終手取り額 (給与 + 年金 + 給付金 - 社保 - 所得税 - 住民税)
        const monthlyNetIncome = (monthlyGrossWage + actualMonthlyPension + employmentContinuationBenefit)
            - socialInsuranceDeduction - incomeTaxDeduction - residentTaxDeduction;

        results.push({
            weeklyHours: hours,
            monthlyGrossWage: Math.round(monthlyGrossWage),
            monthlyPension: Math.round(actualMonthlyPension),
            reductionAmount: Math.round(reductionAmount),
            socialInsuranceDeduction: Math.round(socialInsuranceDeduction),
            incomeTaxDeduction: Math.round(incomeTaxDeduction),
            residentTaxDeduction: Math.round(residentTaxDeduction),
            employmentContinuationBenefit: Math.round(employmentContinuationBenefit),
            monthlyNetIncome: Math.round(monthlyNetIncome),
            realHourlyWage: 0, // あとで計算
        });
    }

    // 実質時給の計算 (1つ前の時間からの手取り増分 / 月間働いた時間数(4.33h))
    for (let i = 1; i < results.length; i++) {
        const netIncomeDiff = results[i].monthlyNetIncome - results[i - 1].monthlyNetIncome;
        // 1時間増えることによる月の労働時間の増加は 1 * 4.33 
        results[i].realHourlyWage = Math.round(netIncomeDiff / WEEKS_PER_MONTH);
    }
    // 0時間目はベース時給の同じ値を入れておく
    if (results.length > 0) {
        results[0].realHourlyWage = params.hourlyWage;
    }

    return results;
}
