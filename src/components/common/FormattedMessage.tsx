import React from 'react';
import { parseAsteriskFormatting, type FormattedTextPart } from '../../utils/messageFormatting';

interface FormattedMessageProps {
  text: string;
  className?: string;
}

/**
 * Component that renders message text with asterisk-based bold formatting
 * Converts *text* to bold text while preserving line breaks and spacing
 */
export function FormattedMessage({ text, className = '' }: FormattedMessageProps) {
  if (!text || typeof text !== 'string') {
    return <span className={className}>{text}</span>;
  }

  const parts = parseAsteriskFormatting(text);

  return (
    <span className={className}>
      {parts.map((part: FormattedTextPart, index: number) => {
        if (part.isBold) {
          return (
            <strong key={index} className="font-semibold">
              {part.text}
            </strong>
          );
        } else {
          // Preserve line breaks and spacing in plain text
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part.text}
            </span>
          );
        }
      })}
    </span>
  );
}

/**
 * Example usage component for testing
 */
export function FormattedMessageExample() {
  const examples = [
    "Hello *world*, this is a *test* message!",
    "*Bold at start* and middle *bold* and end *bold*",
    "No formatting here",
    "*Unmatched asterisk here",
    "Mixed *bold* with\nnew lines and *more bold*",
    "Double **empty** bold and *normal bold*",
  ];

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-gray-900">FormattedMessage Examples:</h3>
      {examples.map((example, index) => (
        <div key={index} className="space-y-1">
          <div className="text-xs text-gray-500 font-mono">
            Input: "{example}"
          </div>
          <div className="text-sm bg-white p-2 rounded border">
            <FormattedMessage text={example} />
          </div>
        </div>
      ))}
    </div>
  );
}