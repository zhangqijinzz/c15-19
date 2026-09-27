import type { EnergyDevice, EnergyEstimate, EnergyScenario, ScenarioSummary } from './types';

export const MAX_DAILY_HOURS = 24;

export const exampleScenario: EnergyScenario = {
  id: 'scenario-home',
  name: '夏日居家方案',
  pricePerKwh: 0.62,
  daysPerMonth: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  devices: [
    { id: 'device-aircon', name: '客厅空调', watts: 1200, dailyHours: 6 },
    { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10 },
    { id: 'device-lamp', name: '书桌台灯', watts: 12, dailyHours: 5 },
  ],
};

export function estimateDevice(device: EnergyDevice, daysPerMonth: number, pricePerKwh: number): EnergyEstimate {
  const dailyKwh = (device.watts * device.dailyHours) / 1000;
  const monthlyKwh = dailyKwh * daysPerMonth;
  return { dailyKwh, monthlyKwh, monthlyCost: monthlyKwh * pricePerKwh };
}

export function summarizeScenario(scenario: EnergyScenario): ScenarioSummary {
  const devices = scenario.devices.map((device) => ({
    ...device,
    ...estimateDevice(device, scenario.daysPerMonth, scenario.pricePerKwh),
    share: 0,
  }));
  const total = devices.reduce(
    (sum, device) => ({
      dailyKwh: sum.dailyKwh + device.dailyKwh,
      monthlyKwh: sum.monthlyKwh + device.monthlyKwh,
      monthlyCost: sum.monthlyCost + device.monthlyCost,
    }),
    { dailyKwh: 0, monthlyKwh: 0, monthlyCost: 0 },
  );
  return {
    total,
    devices: devices.map((device) => ({ ...device, share: total.monthlyKwh ? device.monthlyKwh / total.monthlyKwh : 0 })),
  };
}

export function validateDevice(device: Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours'>): string | null {
  if (!device.name.trim()) return '请填写设备名称';
  if (!Number.isFinite(device.watts) || device.watts < 0) return '功率不能为负数';
  if (!Number.isFinite(device.dailyHours) || device.dailyHours < 0) return '使用时间不能为负数';
  if (device.dailyHours > MAX_DAILY_HOURS) return '每日使用时间不能超过 24 小时';
  return null;
}

export function validateScenarioSettings(pricePerKwh: number, daysPerMonth: number): string | null {
  if (!Number.isFinite(pricePerKwh) || pricePerKwh < 0) return '电价不能为负数';
  if (!Number.isFinite(daysPerMonth) || daysPerMonth < 1 || daysPerMonth > 31) return '计费天数需在 1–31 天之间';
  return null;
}

export function validateScenarioName(name: string): string | null {
  if (!name.trim()) return '方案名称不能为空';
  return null;
}

/**
 * 列表展示名：同名方案按列表顺序追加（2）（3）…，保证任何数据
 * （包括历史遗留的同名副本）在列表里都不会长得一模一样。
 * 存储的原始名字不变，仅用于展示。
 */
export function scenarioDisplayNames(scenarios: EnergyScenario[]): Map<string, string> {
  const seen = new Map<string, number>();
  const displayNames = new Map<string, string>();
  for (const scenario of scenarios) {
    const count = seen.get(scenario.name) ?? 0;
    seen.set(scenario.name, count + 1);
    displayNames.set(scenario.id, count === 0 ? scenario.name : `${scenario.name}（${count + 1}）`);
  }
  return displayNames;
}

/** 把方案在列表中向上/下移动一位；越界或不存在时原样返回（同一引用）。 */
export function reorderScenario(scenarios: EnergyScenario[], id: string, offset: number): EnergyScenario[] {
  const from = scenarios.findIndex((scenario) => scenario.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= scenarios.length) return scenarios;
  const next = scenarios.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * 删除方案后解析仍有效的活动方案：删的不是当前方案则保持不变；
 * 删的是当前方案则落到相邻方案上（优先后一个，删的是末尾则落到前一个）。
 */
export function resolveActiveScenarioAfterRemoval(scenarios: EnergyScenario[], removedId: string, activeId: string): string {
  const remaining = scenarios.filter((scenario) => scenario.id !== removedId);
  if (remaining.length === 0) return activeId;
  if (activeId !== removedId && remaining.some((scenario) => scenario.id === activeId)) return activeId;
  const removedIndex = scenarios.findIndex((scenario) => scenario.id === removedId);
  return remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)].id;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function cloneScenario(source: EnergyScenario, id: string, name: string): EnergyScenario {
  return { ...source, id, name, createdAt: new Date().toISOString(), devices: source.devices.map((device) => ({ ...device, id: `${id}-${device.id}` })) };
}
