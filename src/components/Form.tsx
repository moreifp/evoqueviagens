export const inputCls =
  "tap w-full rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground";

export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-base font-bold text-foreground">{rotulo}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
