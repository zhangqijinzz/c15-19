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

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function cloneScenario(source: EnergyScenario, id: string, name: string): EnergyScenario {
  return { ...source, id, name, createdAt: new Date().toISOString(), devices: source.devices.map((device) => ({ ...device, id: `${id}-${device.id}` })) };
}

export const FALLBACK_SCENARIO_NAME = '未命名方案';
const COPY_SUFFIX = ' · 副本';
const COPY_SUFFIX_PATTERN = /(?: · 副本(?: \d+)?)+$/;

/** 在 taken 中找到一个不冲突的名字：原名可用就用原名，否则依次尝试「名字 2」「名字 3」… */
export function dedupeScenarioName(desired: string, taken: ReadonlySet<string>): string {
  const base = desired.trim() || FALLBACK_SCENARIO_NAME;
  if (!taken.has(base)) return base;
  let index = 2;
  let candidate = `${base} ${index}`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `${base} ${index}`;
  }
  return candidate;
}

/** 为 source 的副本生成名字：先剥掉已有的「· 副本」尾巴，避免后缀一路叠加 */
export function nextCopyName(sourceName: string, taken: ReadonlySet<string>): string {
  const base = sourceName.trim().replace(COPY_SUFFIX_PATTERN, '') || FALLBACK_SCENARIO_NAME;
  return dedupeScenarioName(`${base}${COPY_SUFFIX}`, taken);
}

/** 修正列表中的重名（含旧数据里一模一样的副本名），保持原有顺序，靠后的加序号 */
export function normalizeScenarioNames(scenarios: EnergyScenario[]): EnergyScenario[] {
  const taken = new Set<string>();
  return scenarios.map((scenario) => {
    const name = dedupeScenarioName(scenario.name, taken);
    taken.add(name);
    return name === scenario.name ? scenario : { ...scenario, name };
  });
}
