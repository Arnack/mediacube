import ReactMarkdown from 'react-markdown'

const components = {
  h1: ({ children }: any) => <h1 className="text-base font-semibold mt-4 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0">{children}</h3>,
  p: ({ children }: any) => <p className="text-sm mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => <ul className="text-sm list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="text-sm list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-sm leading-relaxed">{children}</li>,
  pre: ({ children }: any) => <pre className="font-mono text-xs bg-secondary rounded-md p-2.5 mb-2 overflow-x-auto">{children}</pre>,
  code: ({ children, className }: any) => className
    ? <code className="font-mono text-xs">{children}</code>
    : <code className="font-mono text-xs bg-secondary rounded px-1 py-0.5">{children}</code>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  blockquote: ({ children }: any) => <blockquote className="border-l-2 border-border pl-3 text-muted-foreground my-2">{children}</blockquote>,
  hr: () => <hr className="border-border my-3" />,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{children}</a>,
}

export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}
