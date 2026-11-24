import type React from "react";
import { useEffect, useRef } from "react";

/**
 * Caixa de texto que o navegador não reconhece como campo de cartão.
 * O Chrome/Google Wallet ignora autocomplete="off" nos cartões; como aqui
 * não é um <input>, ele não oferece "salvar cartão". O valor vai para o
 * formulário por um campo oculto (quando `name` é passado).
 */
export function CampoPrivado({
  value,
  onChange,
  name,
  rotulo,
  numerico,
  oculto,
  onEnter,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
  rotulo: string;
  numerico?: boolean;
  /** Mostra bolinhas no lugar das letras (senha). Como não é <input>, o iPhone não oferece senhas guardadas. */
  oculto?: boolean;
  onEnter?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && (el.textContent ?? "") !== value) el.textContent = value;
  }, [value]);
  return (
    <>
      <div
        ref={ref}
        role="textbox"
        aria-label={rotulo}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        inputMode={numerico ? "numeric" : "text"}
        onInput={(e) => onChange((e.currentTarget.textContent ?? "").replace(/\n/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const t = e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ");
          document.execCommand("insertText", false, t);
        }}
        style={oculto ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
        className={`${className ?? ""} flex items-center whitespace-nowrap overflow-x-auto`}
      />
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
