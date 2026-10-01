import { iniciais } from "@/lib/pessoas";

export function AvatarGrupo({ nomes }: { nomes: string[] }) {
  return (
    <div className="flex flex-wrap -space-x-2 gap-y-1" aria-label={nomes.join(", ")}>
      {nomes.map((nome, i) => (
        <span
          key={`${nome}-${i}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-secondary text-sm font-bold text-secondary-foreground"
        >
          {iniciais(nome)}
        </span>
      ))}
    </div>
  );
}
