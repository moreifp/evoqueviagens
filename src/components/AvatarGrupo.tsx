import { iniciais } from "@/lib/pessoas";

export function AvatarGrupo({ nomes }: { nomes: string[] }) {
  return (
    <div className="flex -space-x-2" aria-label={nomes.join(", ")}>
      {nomes.slice(0, 5).map((nome, i) => (
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
