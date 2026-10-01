export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-primary">
        CA
      </div>
      {!collapsed ? (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide text-white">CAL ACE</div>
          <div className="text-[11px] text-white/60">Workforce</div>
        </div>
      ) : null}
    </div>
  );
}
