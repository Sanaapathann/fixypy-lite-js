export function getFixSuggestion(code) {
  const fixes = [];
  const trimmed = code.trim();
  // Remove comments
  const codeWithoutComments = code
    .split('\n')
    .map(line => line.trim().startsWith('#') ? '' : line)
    .join('\n');
  // 1. input() used
  if (codeWithoutComments.includes("input(")) {
    fixes.push({
      suggestion: "input() will open a popup!",
      explanation: "FixyPy supports input() via popup. Enter your value when prompted. And Make sure you're using the variable in code else fixypy wont popup the modal!!",
    });
  }
  // 2. string number operation
   if (/".*"\s*[-+*/]\s*\d+/.test(codeWithoutComments)) {
    fixes.push({
      suggestion: `Convert number to string: "${trimmed.match(/"(.*)"/)?.[1] ?? "text"}" + str(1)`,
      explanation: "You can't subtract/add a number and string directly. Try converting types!",
    });
  }
  // 3. bare identifier (like: a, name)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    fixes.push({
      suggestion: `"${trimmed}"`,
      explanation: `You entered '${trimmed}' - Python sees it as a variable, but it's not defined.\nDid you mean to:\n- Make it a string? → "${trimmed}"\n- Assign it? → ${trimmed} = "value"\n- Print it? → print(${trimmed})`,
    });
  }
  // 4. bare number (like: 5)
  if (/^\d+$/.test(trimmed)) {
    fixes.push({
      suggestion: `print(${trimmed})`,
      explanation: "You typed a number. Want to print it to see the result?",
    });
  }
  // 5. Looks valid (has print)
  if (codeWithoutComments.includes("print(")) {
    return null;
  }
  return fixes.length > 0 ? fixes[0] : null;
} 