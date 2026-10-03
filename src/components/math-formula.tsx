import katex from "katex";
import { cn } from "@/lib/utils";

function normalizeFormula(value: string) {
  return value
    .trim()
    .replace(/^\$\$?|\$\$?$/g, "")
    // Some older generated formulas used "$" where LaTeX requires an opening brace.
    .replace(/\$/g, "{")
    .replace(/\\text\s*([^\s{][^=+\-*/]*)\s*=/g, (_, text: string) => `\\text{${text.trim()}} =`)
    .replace(/\^\{\\frac\{1}\{([^}]+)}}/g, "^{1/$1}");
}

export function MathFormula({ value, className }: { value: string; className?: string }) {
  const formula = normalizeFormula(value);
  try {
    const html = katex.renderToString(formula, {
      displayMode: true,
      throwOnError: true,
      strict: false,
      trust: false,
    });
    return <div className={cn("math-formula overflow-x-auto overflow-y-hidden", className)} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    const readable = formula
      .replace(/\\frac\{([^{}]+)}\{([^{}]+)}/g, "($1) ÷ ($2)")
      .replace(/\\(?:left|right)/g, "")
      .replace(/\\text\{([^{}]+)}/g, "$1")
      .replace(/[{}]/g, "");
    return <div className={cn("whitespace-pre-wrap break-words", className)}>{readable}</div>;
  }
}