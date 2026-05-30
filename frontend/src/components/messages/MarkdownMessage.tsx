"use client";

import ReactMarkdown from 'react-markdown';

const emphasizeMentions = (content: string) => (
  content.replace(/(^|[\s(])@([^\s@.,:;!?，。！？、)]+)/g, '$1**@$2**')
);

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown>
      {emphasizeMentions(content || 'No content')}
    </ReactMarkdown>
  );
}
