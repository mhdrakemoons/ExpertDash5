/**
 * Utility functions for formatting message text
 */

export interface FormattedTextPart {
  text: string;
  isBold: boolean;
}

/**
 * Parse text and identify asterisk pairs for bold formatting
 * Only processes complete pairs of asterisks - ignores unmatched asterisks
 */
export function parseAsteriskFormatting(text: string): FormattedTextPart[] {
  if (!text || typeof text !== 'string') {
    return [{ text: text || '', isBold: false }];
  }

  const parts: FormattedTextPart[] = [];
  let currentIndex = 0;
  let inBold = false;
  let boldStartIndex = -1;

  // Find all asterisk positions
  const asteriskPositions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '*') {
      asteriskPositions.push(i);
    }
  }

  // If we have an odd number of asterisks, ignore the last one
  const validAsterisks = asteriskPositions.slice(0, Math.floor(asteriskPositions.length / 2) * 2);

  if (validAsterisks.length === 0) {
    // No asterisk pairs found, return the whole text as plain
    return [{ text, isBold: false }];
  }

  let asteriskIndex = 0;

  for (let i = 0; i < text.length; i++) {
    if (asteriskIndex < validAsterisks.length && i === validAsterisks[asteriskIndex]) {
      if (!inBold) {
        // Start of bold section
        if (i > currentIndex) {
          // Add the plain text before this asterisk
          parts.push({ text: text.slice(currentIndex, i), isBold: false });
        }
        boldStartIndex = i + 1; // Start after the asterisk
        inBold = true;
      } else {
        // End of bold section
        if (boldStartIndex < i) {
          // Add the bold text (excluding the asterisks)
          const boldText = text.slice(boldStartIndex, i);
          if (boldText.length > 0) {
            parts.push({ text: boldText, isBold: true });
          }
        }
        currentIndex = i + 1; // Continue after this asterisk
        inBold = false;
      }
      asteriskIndex++;
    }
  }

  // Add any remaining plain text
  if (currentIndex < text.length) {
    parts.push({ text: text.slice(currentIndex), isBold: false });
  }

  return parts;
}

/**
 * Test cases for the formatting function
 */
export function testAsteriskFormatting() {
  const testCases = [
    { input: "Hello *world*", expected: [{ text: "Hello ", isBold: false }, { text: "world", isBold: true }] },
    { input: "*Bold* text *here*", expected: [{ text: "Bold", isBold: true }, { text: " text ", isBold: false }, { text: "here", isBold: true }] },
    { input: "No asterisks here", expected: [{ text: "No asterisks here", isBold: false }] },
    { input: "*Unmatched asterisk", expected: [{ text: "*Unmatched asterisk", isBold: false }] },
    { input: "*First* and *second* and *third", expected: [{ text: "First", isBold: true }, { text: " and ", isBold: false }, { text: "second", isBold: true }, { text: " and *third", isBold: false }] },
    { input: "", expected: [{ text: "", isBold: false }] },
    { input: "*", expected: [{ text: "*", isBold: false }] },
    { input: "**", expected: [{ text: "", isBold: true }] },
  ];

  console.log('🧪 Testing asterisk formatting:');
  testCases.forEach((testCase, index) => {
    const result = parseAsteriskFormatting(testCase.input);
    console.log(`Test ${index + 1}: "${testCase.input}" ->`, result);
  });
}