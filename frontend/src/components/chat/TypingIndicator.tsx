/**
 * TypingIndicator Component
 *
 * Displays "User is typing..." indicator for chat blocks.
 */

import { useEffect, useState } from "react";

interface TypingIndicatorProps {
  typingUsers: Set<string>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const [dotCount, setDotCount] = useState(1);

  // Animate dots
  useEffect(() => {
    if (typingUsers.size === 0) return;

    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [typingUsers.size]);

  if (typingUsers.size === 0) {
    return null;
  }

  const userNames = Array.from(typingUsers);
  let displayText = "";

  if (userNames.length === 1) {
    displayText = `${userNames[0]} is typing`;
  } else if (userNames.length === 2) {
    displayText = `${userNames[0]} and ${userNames[1]} are typing`;
  } else {
    displayText = `${userNames[0]}, ${userNames[1]} and ${
      userNames.length - 2
    } ${userNames.length - 2 === 1 ? "other" : "others"} are typing`;
  }

  const dots = ".".repeat(dotCount);

  return (
    <div
      style={{
        padding: "8px 12px",
        color: "#666",
        fontSize: "13px",
        fontStyle: "italic",
      }}
    >
      {displayText}
      {dots}
    </div>
  );
}
