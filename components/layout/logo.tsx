export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center">
      <img
        src="/logo.png"
        alt="CALACE Team"
        className={
          collapsed
            ? "h-10 w-10 rounded-md object-cover"
            : "h-11 w-11 rounded-md object-cover"
        }
      />
      {!collapsed ? (
        <div className="ml-2.5 leading-tight">
          <div className="text-sm font-semibold tracking-wide text-white">CALACE</div>
          <div className="text-[11px] text-white/60">Team</div>
        </div>
      ) : null}
    </div>
  );
}
