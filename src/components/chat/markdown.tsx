"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || "código"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="code-block-copy cursor-pointer"
          aria-label="Copiar código"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "¡Copiado!" : "Copiar"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.85rem",
          lineHeight: 1.6,
        }}
        codeTagProps={{
          style: {
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          },
        }}
        wrapLongLines={false}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

interface CodeProps {
  className?: string;
  children?: ReactNode;
}

export const Markdown = memo(function Markdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="md-content">
      <ReactMarkdown
        urlTransform={(url) =>
          url.startsWith("data:image/") ? url : defaultUrlTransform(url)
        }
        components={{
          code({ className, children }: CodeProps) {
            const match = /language-([\w-]+)/.exec(className || "");
            const text = String(children ?? "").replace(/\n$/, "");
            if (match || text.includes("\n")) {
              return <CodeBlock language={match?.[1] ?? ""} value={text} />;
            }
            return <span className="inline-code">{children}</span>;
          },
          a({ children, href }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            const url = typeof src === "string" ? src : "";
            if (!url) return null;
            return (
              <img
                src={url}
                alt={alt ?? "Imagen generada"}
                className="generated-image"
                loading="lazy"
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
