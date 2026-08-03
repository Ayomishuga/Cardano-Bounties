import React from "react";

export function ContentWithLinks({ content, linkClassName }: { content: string | null | undefined; linkClassName?: string }) {
  if (!content) return <span>No submission content provided.</span>;

  // Replace old "Reviewer notes:" with "Notes:" for retroactive compatibility
  const sanitizedContent = content.replace(/Reviewer notes:/g, "Notes:");

  // Split by whitespace to find URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = sanitizedContent.split(urlRegex);

  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={linkClassName}>
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
