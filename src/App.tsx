import { useState, useMemo } from "react";
import type { WorkerParams, SimulationResult } from "./lib/simulation";
import { simulateNetIncome } from "./lib/simulation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend, Label } from "recharts";
import { User, Banknote, ShieldAlert, Settings, Info, Users, Clock, TrendingUp, ChevronRight, FileText, CheckCircle2 } from "lucide-react";
import LogoImage from "./assets/TEDLy-small.png";

// Mock Data for B2B Dashboard
interface Employee extends WorkerParams {
  id: string;
  name: string;
  currentWeeklyHours: number;
}

const mockEmployees: Employee[] = [
  {
    id: "e1",
    name: "佐藤 定男 (66歳)",
    age: 66,
    basicPension: 780000,
    employeePension: 650000,
    spouseAllowance: 400000, // 配偶者加給年金あり
    hourlyWage: 1250,
    wageAt60: 250000, // 高年齢雇用継続給付金の計算ベース
    annualBonus: 300000, // 年金カットの計算ベース
    currentWeeklyHours: 20,
    payslip: {
      baseSalary: 108333,
      socialInsurance: 15450,
      incomeTax: 1250,
      residentTax: 3500,
      netIncome: 88133,
    },
    pensionNotice: {
      monthlyPension: 119166,
      suspendedAmount: 0,
    },
    continuedBenefitsNotice: {
      paymentAmount: 16250,
      paymentRate: 15,
    },
    residentTaxNotice: {
      monthlySpecialCollection: 3500,
    },
  },
  {
    id: "e2",
    name: "鈴木 恵子 (63歳)",
    age: 63,
    basicPension: 0, // 65歳未満のため特別支給の老齢厚生年金のみと仮定
    employeePension: 1100000,
    hourlyWage: 1150,
    wageAt60: 220000,
    annualBonus: 200000,
    currentWeeklyHours: 28,
    payslip: {
      baseSalary: 139533,
      socialInsurance: 19800,
      incomeTax: 1850,
      residentTax: 4200,
      netIncome: 113683,
    },
    pensionNotice: {
      monthlyPension: 91666,
      suspendedAmount: 0,
    },
  },
  {
    id: "e3",
    name: "高橋 健一 (70歳)",
    age: 70,
    basicPension: 780000,
    employeePension: 1400000,
    spouseAllowance: 400000,
    hourlyWage: 1500,
    wageAt60: 300000,
    annualBonus: 0,
    currentWeeklyHours: 15,
  },
  {
    id: "e4",
    name: "田中 修 (68歳 - 高給与モデル)",
    age: 68,
    basicPension: 780000,
    employeePension: 1800000, // 年金が多め
    spouseAllowance: 0,
    hourlyWage: 2000, // 時給高め：在職老齢年金の停止に引っかかりやすい
    wageAt60: 450000,
    annualBonus: 1200000, // 賞与が多いため、年金が停止しやすい
    currentWeeklyHours: 35, // 働きすぎで年金が止まり、働き損が起きているケース
  },
  {
    id: "e5",
    name: "伊藤 裕子 (62歳 - 扶養内パート層)",
    age: 62,
    basicPension: 0,
    employeePension: 600000,
    hourlyWage: 1100,
    wageAt60: 150000,
    annualBonus: 100000,
    currentWeeklyHours: 25, // 130万の壁・20時間の壁に直面するケース
  }
];

export default function App() {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(mockEmployees[0].id);
  const [editingParams, setEditingParams] = useState<WorkerParams>(mockEmployees[0]);

  // Sync editing params when selected employee changes
  useMemo(() => {
    const emp = mockEmployees.find(e => e.id === selectedEmpId);
    if (emp) setEditingParams(emp);
  }, [selectedEmpId]);

  const activeEmployee = mockEmployees.find(e => e.id === selectedEmpId) || mockEmployees[0];
  const data = useMemo(() => simulateNetIncome(editingParams), [editingParams]);

  // "最適時間（手取り最大推奨）" の再定義:
  // 1. まず最初に訪れる強烈な崖（実質時給がマイナスになるポイント）を探す
  const firstCliffIndex = data.findIndex((d, i) => i > 0 && d.realHourlyWage < 0);

  // 2. 崖が見つかった場合、その直前を推奨時間とする
  const optimalHours = firstCliffIndex > 0 ? firstCliffIndex - 1 : 40;

  const currentHours = activeEmployee.currentWeeklyHours;
  const potentialExtraHours = Math.max(0, optimalHours - currentHours);

  // 働き損リカバリー判定
  // 現在のシフトが推奨の壁を超えている場合
  let isWorkingLoss = false;
  let recoveryAmount = 0;
  let reductionHours = 0;

  const currentNetIncome = data.find(d => d.weeklyHours === currentHours)?.monthlyNetIncome || 0;
  const optimalNetIncome = data.find(d => d.weeklyHours === optimalHours)?.monthlyNetIncome || 0;

  if (currentHours > optimalHours && optimalHours !== 40) {
    // 【判定条件1】単に手取りが壁の時より少ない（絶対的な働き損）
    if (currentNetIncome < optimalNetIncome) {
      isWorkingLoss = true;
      recoveryAmount = optimalNetIncome - currentNetIncome;
      reductionHours = currentHours - optimalHours;
    }
    // 【判定条件2】手取りは増えているが、時給が最低賃金レベルを大きく下回る「実質的な働き損ゾーン」にいる
    // 例：10時間余分に働いて、手取りが1000円しか増えていない場合など
    else {
      const extraHoursWorked = currentHours - optimalHours;
      const extraIncomeEarned = currentNetIncome - optimalNetIncome;
      const effectiveHourlyWageAfterCliff = extraIncomeEarned / (extraHoursWorked * 4.33);

      // 壁を超えた後の実質時給が、本来の時給の75%以下なら「働き損状態（タイパ悪化）」とみなす
      // 高給与モデル（田中修）などは、時給額が高いため50%以下だと引っかからないケースがある
      if (effectiveHourlyWageAfterCliff < (activeEmployee.hourlyWage * 0.75)) {
        isWorkingLoss = true;
        recoveryAmount = extraIncomeEarned; // "これだけ削っても〇〇円しか減りませんよ"の意
        reductionHours = extraHoursWorked;
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Noto_Sans_JP',_sans-serif] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shrink-0">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src={LogoImage} alt="TEDLy Logo" className="h-7 w-auto mr-2" />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar: Employee List */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700 flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span>登録シニア従業員</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {mockEmployees.map((emp) => {
              const isSelected = emp.id === selectedEmpId;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmpId(emp.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${isSelected
                    ? "bg-blue-50 border-blue-200 shadow-sm"
                    : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  <div>
                    <div className={`font-semibold text-sm ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                      {emp.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                      <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />週{emp.currentWeeklyHours}h稼働</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? "text-blue-500" : "text-slate-300"}`} />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Value Proposition Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Employee Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm col-span-1 md:col-span-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">{activeEmployee.name} の稼働ポテンシャル</h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      現在の年齢、年金受給額、時給から「働き損」にならない安全な最大稼働時間を算出しています。
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-center">
                    <span className="block text-[10px] text-slate-500 font-bold mb-0.5">現在シフト</span>
                    <span className="text-lg font-bold text-slate-800">{currentHours}<span className="text-xs font-normal text-slate-500 ml-0.5">h/週</span></span>
                  </div>
                </div>
              </div>

              {/* Actionable Insights Card */}
              {isWorkingLoss ? (
                // 働き損リカバリーのアラートカード (赤色)
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-sm relative overflow-hidden col-span-1">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>

                  <h3 className="text-xs font-bold flex items-center space-x-1.5 mb-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span className="text-rose-800">
                      重大な「働き損」を検知
                    </span>
                  </h3>

                  <div className="flex flex-col space-y-1 mt-3">
                    <div className="flex items-end space-x-2">
                      <span className="text-sm font-bold text-rose-700">週シフトを</span>
                      <span className="text-3xl font-black text-rose-600">-{reductionHours}</span>
                      <span className="text-sm mb-1 font-bold text-rose-700">h に最適化提案</span>
                    </div>
                  </div>

                  <p className="text-[11px] mt-3 leading-tight text-rose-700 bg-white/50 p-2 rounded border border-rose-100">
                    現在のシフトは社会保険等の「壁」を超えてしまっています。<br />
                    {currentNetIncome < (data.find(d => d.weeklyHours === optimalHours)?.monthlyNetIncome || 0)
                      ? <b className="text-rose-800 bg-rose-200/50 px-1 rounded block mt-1">直前の {optimalHours} 時間に減らすことで、手取りが {recoveryAmount.toLocaleString()}円 増えます。（絶対的働き損）</b>
                      : <b className="text-rose-800 bg-rose-200/50 px-1 rounded block mt-1">壁を超えた {reductionHours} 時間分の労働は、月平均 {Math.round(recoveryAmount / (reductionHours * 4.33)).toLocaleString()}円/時 の価値しか生んでいません。（タイパ悪化）</b>
                    }
                  </p>
                </div>
              ) : (
                // 通常の追加ポテンシャルカード (緑色 or グレー)
                <div className={`border rounded-xl p-5 shadow-sm relative overflow-hidden ${potentialExtraHours > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
                  {potentialExtraHours > 0 && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}

                  <h3 className="text-xs font-bold flex items-center space-x-1.5 mb-2">
                    <TrendingUp className={`w-4 h-4 ${potentialExtraHours > 0 ? "text-emerald-600" : "text-slate-500"}`} />
                    <span className={potentialExtraHours > 0 ? "text-emerald-800" : "text-slate-600"}>
                      企業の追加労働力確保
                    </span>
                  </h3>

                  <div className="flex items-end space-x-2">
                    <span className={`text-4xl font-black ${potentialExtraHours > 0 ? "text-emerald-600" : "text-slate-800"}`}>
                      {potentialExtraHours > 0 ? `+${potentialExtraHours}` : "0"}
                    </span>
                    <span className={`text-sm mb-1 font-bold ${potentialExtraHours > 0 ? "text-emerald-700" : "text-slate-500"}`}>h / 週</span>
                  </div>

                  <p className={`text-[11px] mt-2 leading-tight ${potentialExtraHours > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                    {potentialExtraHours > 0
                      ? `この従業員は壁（${optimalHours}時間）に当たらず、手取りを最大化しながらさらに労働力を提供できる余裕があります。`
                      : currentHours > optimalHours
                        ? `壁は超えていますが、目前の「働き損」状態は脱却し、総手取りは増加傾向にあります。`
                        : "この従業員は現在、手取り額が最大化する最適な時間数で稼働しています。"}
                  </p>
                </div>
              )}

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Chart Panel */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-[500px] lg:h-auto overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-blue-600" />
                      <span>手取りシミュレーション推移</span>
                    </h2>
                  </div>
                </div>

                <div className="flex-1 w-full p-6 min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNetIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorDeduction" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

                      <XAxis
                        dataKey="weeklyHours"
                        stroke="#64748b"
                        tickFormatter={(val) => `${val}h`}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        tickMargin={12}
                      />

                      <YAxis
                        stroke="#64748b"
                        tickFormatter={(val) => `¥${(val / 10000).toFixed(0)}万`}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={12}
                      />

                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                        iconType="circle"
                      />

                      <Area
                        name="社会保険・税・年金停止等（控除額）"
                        type="monotone"
                        dataKey={(d) => d.monthlyGrossWage + d.monthlyPension + d.employmentContinuationBenefit}
                        stroke="#f43f5e"
                        fillOpacity={1}
                        fill="url(#colorDeduction)"
                        strokeWidth={2}
                        activeDot={{ r: 5, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                      />

                      <Area
                        name="最終手取り（給付金含む額 - 控除額）"
                        type="monotone"
                        dataKey="monthlyNetIncome"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorNetIncome)"
                        strokeWidth={3}
                        activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                      />

                      <ReferenceLine x={optimalHours} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2}>
                        {/* @ts-ignore */}
                        <Label value="手取り最大（推奨）" position="top" fill="#10b981" fontSize={12} fontWeight="bold" />
                      </ReferenceLine>

                      <ReferenceLine x={currentHours} stroke="#64748b" strokeDasharray="3 3">
                        {/* @ts-ignore */}
                        <Label value="現在シフト" position="bottom" fill="#64748b" fontSize={11} />
                      </ReferenceLine>

                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Edit Controls Panel */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>シミュレーション条件編集</span>
                    </h2>
                  </div>

                  <div className="p-5 space-y-5">
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex items-center space-x-3 mb-2">
                      <Info className="w-4 h-4 text-blue-500 shrink-0" />
                      <p className="text-xs text-blue-800 leading-relaxed">
                        年齢や時給を変更して、昇給時などに「働き損」ラインがどう変化するかシミュレーション可能です。
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>年齢</span>
                      </label>
                      <input
                        type="number"
                        value={editingParams.age}
                        readOnly // For MVP we keep age mostly static to the employee, but allow UI if needed
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 font-medium text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Banknote className="w-4 h-4 text-slate-400" />
                        <span>想定時給</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editingParams.hourlyWage}
                          step={50}
                          onChange={e => setEditingParams({ ...editingParams, hourlyWage: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pl-8 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">¥</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Banknote className="w-4 h-4 text-slate-400" />
                        <span>老齢基礎年金（年額）</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editingParams.basicPension}
                          step={10000}
                          onChange={e => setEditingParams({ ...editingParams, basicPension: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pl-8 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">¥</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Banknote className="w-4 h-4 text-slate-400" />
                        <span>老齢厚生年金（年額）</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editingParams.employeePension}
                          step={10000}
                          onChange={e => setEditingParams({ ...editingParams, employeePension: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pl-8 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">¥</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* 必要書類からの抽出データ連携 パネル */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>必要書類からの抽出データ（シミュレーション補正用）</span>
                </h2>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 bg-slate-50/50">

                {/* 1. 給与明細 */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xs font-bold text-slate-700">給与明細</h3>
                    {editingParams.payslip ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">未登録</div>}
                  </div>
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-3 font-semibold">用途: 現在のベースライン</div>
                  {editingParams.payslip ? (
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>基本給</span><span className="font-semibold text-slate-800">¥{editingParams.payslip.baseSalary.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>社保各項目</span><span className="font-semibold text-slate-800">¥{editingParams.payslip.socialInsurance.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>所得税</span><span className="font-semibold text-slate-800">¥{editingParams.payslip.incomeTax.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>住民税</span><span className="font-semibold text-slate-800">¥{editingParams.payslip.residentTax.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-slate-800 pt-1"><span>手取り額</span><span className="text-blue-700">¥{editingParams.payslip.netIncome.toLocaleString()}</span></div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic text-center py-4">データなし</div>
                  )}
                </div>

                {/* 2. 年金振込通知書 */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xs font-bold text-slate-700">年金振込通知書</h3>
                    {editingParams.pensionNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">未登録</div>}
                  </div>
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-3 font-semibold">用途: 在職老齢年金の実数値</div>
                  {editingParams.pensionNotice ? (
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>年金月額</span><span className="font-semibold text-slate-800">¥{editingParams.pensionNotice.monthlyPension.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>停止額</span><span className="font-semibold text-rose-600">¥{editingParams.pensionNotice.suspendedAmount.toLocaleString()}</span></div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic text-center py-4">データなし</div>
                  )}
                </div>

                {/* 3. 継続給付金支給決定通知書 */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xs font-bold text-slate-700 leading-tight">継続給付金支給決定通知書</h3>
                    {editingParams.continuedBenefitsNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-2" /> : <div className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded shrink-0 ml-2">未登録</div>}
                  </div>
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-3 font-semibold">用途: 給付金の実数値</div>
                  {editingParams.continuedBenefitsNotice ? (
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>支給額</span><span className="font-semibold text-slate-800">¥{editingParams.continuedBenefitsNotice.paymentAmount.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>支給率</span><span className="font-semibold text-slate-800">{editingParams.continuedBenefitsNotice.paymentRate}%</span></div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic text-center py-4">データなし</div>
                  )}
                </div>

                {/* 4. 住民税決定通知書 */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xs font-bold text-slate-700">住民税決定通知書</h3>
                    {editingParams.residentTaxNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">未登録</div>}
                  </div>
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-3 font-semibold">用途: 住民税の正確な値</div>
                  {editingParams.residentTaxNotice ? (
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between border-b border-slate-100 pb-1"><span>月額特別徴収額</span><span className="font-semibold text-slate-800">¥{editingParams.residentTaxNotice.monthlySpecialCollection.toLocaleString()}</span></div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic text-center py-4">データなし</div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as SimulationResult;
    const format = (val: number) => new Intl.NumberFormat('ja-JP').format(val) + "円";

    // 実質時給が基本時給を下回っているか（働き損）
    const nominalHourlyWage = data.monthlyGrossWage / (data.weeklyHours * 4.33);
    const isLoss = data.weeklyHours > 0 && data.realHourlyWage < nominalHourlyWage;
    const isExtremeLoss = data.realHourlyWage < 0;

    return (
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xl max-w-[320px]">
        <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
          <p className="text-slate-800 font-bold text-sm">週 {label} 時間シフト</p>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block leading-tight">1時間追加した場合の<br />実質時給（増分）</span>
            <span className={`text-sm font-black ${isExtremeLoss ? "text-rose-600" : isLoss ? "text-amber-600" : "text-emerald-600"}`}>
              {format(data.realHourlyWage)}
            </span>
            {isExtremeLoss && <span className="ml-1 text-[10px] font-bold text-white bg-rose-600 px-1 py-0.5 rounded">赤字</span>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">額面給与</span>
            <span className="text-slate-900 font-medium">{format(data.monthlyGrossWage)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">本来の月額年金</span>
            <span className="text-slate-900 font-medium">{format(data.monthlyPension + data.reductionAmount)}</span>
          </div>
          {data.employmentContinuationBenefit > 0 && (
            <div className="flex justify-between items-center text-xs text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
              <span>高年齢雇用継続給付金</span>
              <span className="font-bold">+{format(data.employmentContinuationBenefit)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-slate-50">
            <span className="text-rose-600">在職老齢年金停止額</span>
            <span className="text-rose-600 font-medium">{format(data.reductionAmount) === "0円" ? "0円" : `-${format(data.reductionAmount)}`}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-rose-600">社保・税等控除</span>
            <span className="text-rose-600 font-medium">{format(data.socialInsuranceDeduction + data.incomeTaxDeduction) === "0円" ? "0円" : `-${format(data.socialInsuranceDeduction + data.incomeTaxDeduction)}`}</span>
          </div>
          {data.residentTaxDeduction > 0 && (
            <div className="flex justify-between items-center text-xs text-rose-600">
              <span>住民税（前年ベース固定）</span>
              <span className="font-medium">-{format(data.residentTaxDeduction)}</span>
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center text-sm">
            <span className="text-blue-700 font-bold">最終手取り月額</span>
            <span className="text-blue-700 font-bold text-base">{format(data.monthlyNetIncome)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};
