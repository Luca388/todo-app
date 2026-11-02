type SidebarProps = {
  authDescription: string;
  authDisabled: boolean;
  authInitial: string;
  authLabel: string;
  onAuthAction: () => void;
};

export function Sidebar({
  authDescription,
  authDisabled,
  authInitial,
  authLabel,
  onAuthAction,
}: SidebarProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✓</span>
        <strong>하루</strong>
      </div>

      <button
        className="profile-button"
        type="button"
        onClick={onAuthAction}
        disabled={authDisabled}
        title={authDescription}
      >
        <span className="avatar" aria-hidden="true">{authInitial}</span>
        <span className="profile-copy">
          <strong>{authLabel}</strong>
          <small>{authDescription}</small>
        </span>
      </button>
    </header>
  );
}
