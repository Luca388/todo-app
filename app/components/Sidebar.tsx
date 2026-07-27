type SidebarProps = {
  authDescription: string;
  authDisabled: boolean;
  authInitial: string;
  authLabel: string;
  completedCount: number;
  onAuthAction: () => void;
  totalCount: number;
};

const navItems = [
  { icon: "◷", label: "오늘", active: true },
  { icon: "□", label: "예정", active: false },
  { icon: "✓", label: "완료", active: false },
  { icon: "◫", label: "기록", active: false },
] as const;

export function Sidebar({
  authDescription,
  authDisabled,
  authInitial,
  authLabel,
  completedCount,
  onAuthAction,
  totalCount,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">●</span>
        <span>하루</span>
      </div>

      <nav className="side-nav" aria-label="주요 메뉴">
        <p className="nav-caption">나의 하루</p>
        {navItems.map((item) => (
          <button
            className={`nav-item ${item.active ? "is-active" : ""}`}
            type="button"
            key={item.label}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            {item.active && <span className="nav-count">{totalCount - completedCount}</span>}
          </button>
        ))}
      </nav>

      <div className="streak-card">
        <div className="streak-topline">
          <span className="streak-icon" aria-hidden="true">✦</span>
          <span>이번 주 집중</span>
        </div>
        <strong>3일 연속</strong>
        <div className="streak-days" aria-label="이번 주 집중 기록">
          {["월", "화", "수", "목", "금"].map((day, index) => (
            <span className={index < 3 ? "is-done" : ""} key={day}>{day}</span>
          ))}
        </div>
      </div>

      <button
        className="profile-button"
        type="button"
        onClick={onAuthAction}
        disabled={authDisabled}
      >
        <span className="avatar" aria-hidden="true">{authInitial}</span>
        <span className="profile-copy">
          <strong>{authLabel}</strong>
          <small>{authDescription}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </aside>
  );
}
