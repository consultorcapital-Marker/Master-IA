declare module "react-syntax-highlighter" {
  import type { ComponentType, ReactNode } from "react";
  export interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, Record<string, string | number>>;
    children?: ReactNode;
    customStyle?: Record<string, string | number>;
    codeTagProps?: Record<string, unknown>;
    wrapLongLines?: boolean;
    showLineNumbers?: boolean;
    [key: string]: unknown;
  }
  export const Prism: ComponentType<SyntaxHighlighterProps>;
  const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
  export default SyntaxHighlighter;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism" {
  export const oneDark: Record<string, Record<string, string | number>>;
  export const vscDarkPlus: Record<string, Record<string, string | number>>;
}
