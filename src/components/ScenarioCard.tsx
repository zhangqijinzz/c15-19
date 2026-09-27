import { useState } from 'react';
import { formatNumber } from '../domain';
import type { EnergyScenario } from '../types';

interface ScenarioCardProps {
  scenario: EnergyScenario;
  displayName: string;
  totalKwh: number;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove: (offset: -1 | 1) => void;
}

export function ScenarioCard({ scenario, displayName, totalKwh, active, isFirst, isLast, canDelete, onSelect, onRename, onDelete, onMove }: ScenarioCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scenario.name);

  const startRename = () => { setDraft(scenario.name); setEditing(true); };
  const commitRename = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== scenario.name) onRename(next);
  };

  if (editing) {
    return (
      <div className={`scenario-card editing ${active ? 'active' : ''}`}>
        <input
          className="scenario-rename"
          value={draft}
          autoFocus
          aria-label="方案名称"
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename();
            if (event.key === 'Escape') setEditing(false);
          }}
          onBlur={commitRename}
        />
        <div className="scenario-actions">
          <button aria-label="确认重命名" title="确认" onMouseDown={(event) => event.preventDefault()} onClick={commitRename}>✓</button>
          <button aria-label="取消重命名" title="取消" onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(false)}>×</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`scenario-card ${active ? 'active' : ''}`}>
      <button className="scenario-select" onClick={onSelect} aria-label={`查看方案 ${displayName}`}>
        <span className="scenario-dot" />
        <span className="scenario-copy"><strong>{displayName}</strong><small>{scenario.devices.length} 台设备 · {formatNumber(totalKwh)} kWh / 月</small></span>
        <span className="arrow">→</span>
      </button>
      <div className="scenario-actions">
        <button aria-label="上移方案" title="上移" disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
        <button aria-label="下移方案" title="下移" disabled={isLast} onClick={() => onMove(1)}>↓</button>
        <button aria-label="重命名方案" title="重命名" onClick={startRename}>✎</button>
        <button className="danger" aria-label="删除方案" title={canDelete ? '删除' : '至少保留一个方案'} disabled={!canDelete} onClick={onDelete}>×</button>
      </div>
    </div>
  );
}
