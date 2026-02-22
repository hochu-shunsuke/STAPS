import { useState, useMemo } from "react";
import type { WorkerParams, SimulationResult } from "./lib/simulation";
import { simulateNetIncome } from "./lib/simulation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend, Label } from "recharts";
import { User, Banknote, ShieldAlert, Settings, Info, Users, Clock, TrendingUp, ChevronRight } from "lucide-react";
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
    hourlyWage: 1250,
    currentWeeklyHours: 20,
  },
  {
    id: "e2",
    name: "鈴木 恵子 (63歳)",
    age: 63,
    basicPension: 0, // 65歳未満のため特別支給の老齢厚生年金のみと仮定
    employeePension: 1100000,
    hourlyWage: 1150,
    currentWeeklyHours: 28,
  },
  {
    id: "e3",
    name: "高橋 健一 (70歳)",
    age: 70,
    basicPension: 780000,
    employeePension: 1400000,
    hourlyWage: 1500,
    currentWeeklyHours: 15,
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

  const peakNetIncome = Math.max(...data.map(d => d.monthlyNetIncome));
  const optimalHours = data.find(d => d.monthlyNetIncome === peakNetIncome)?.weeklyHours || 0;

  // Calculate Company Value (Untapped Potential)
  const currentHours = activeEmployee.currentWeeklyHours;
  const potentialExtraHours = Math.max(0, optimalHours - currentHours);

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
                    ? "この従業員は自身の手取りを減らすことなく、さらに企業へ労働力を提供できる余裕があります。"
                    : "この従業員は現在、手取り額が最大化する最適な時間数で稼働しています。"}
                </p>
              </div>

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
                        dataKey={(d) => d.monthlyGrossWage + d.monthlyPension}
                        stroke="#f43f5e"
                        fillOpacity={1}
                        fill="url(#colorDeduction)"
                        strokeWidth={2}
                        activeDot={{ r: 5, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                      />

                      <Area
                        name="最終手取り（給与＋年金残額）"
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

    return (
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xl max-w-[280px]">
        <p className="text-slate-800 font-bold text-sm mb-3 border-b border-slate-100 pb-2">
          週 {label} 時間のシフト
        </p>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">額面給与</span>
            <span className="text-slate-900 font-medium">{format(data.monthlyGrossWage)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">本来の月額年金</span>
            <span className="text-slate-900 font-medium">{format(data.monthlyPension + data.reductionAmount)}</span>
          </div>

          <div className="flex justify-between items-center text-xs pt-2">
            <span className="text-rose-600">年金停止額</span>
            <span className="text-rose-600 font-medium">{format(data.reductionAmount) === "0円" ? "0円" : `-${format(data.reductionAmount)}`}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-rose-600">社保・税等控除</span>
            <span className="text-rose-600 font-medium">{format(data.socialInsuranceDeduction + data.incomeTaxDeduction) === "0円" ? "0円" : `-${format(data.socialInsuranceDeduction + data.incomeTaxDeduction)}`}</span>
          </div>

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
