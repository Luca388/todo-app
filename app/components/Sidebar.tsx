type SidebarProps = {
  authDescription: string;
  authDisabled: boolean;
  authInitial: string;
  authLabel: string;
  completedCount: number;
  onAuthAction: () => void;
  totalCount: number;
};

export function Sidebar({
  authDescription,
  authDisabled,
  authInitial,
  authLabel,
  completedCount,
  onAuthAction,
  totalCount,
}: SidebarProps) {
  const remainingCount = totalCount - completedCount;

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">●</span>
        <span className="brand-copy">
          <strong>하루</strong>
          <small>Todo & Focus</small>
        </span>
      </div>

      <div className="header-actions">
        <div className="header-task-status" aria-label="오늘 할 일 현황">
          <span>{remainingCount}개 남음</span>
          <span aria-hidden="true">·</span>
          <span>{completedCount}/{totalCount} 완료</span>
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
        </button>
      </div>
    </header>
  );
}
