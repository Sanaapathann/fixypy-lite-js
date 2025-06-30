function getLevenshteinDistance(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(
        dp[i - 1][j - 1] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j] + 1
      );
    }
  }
  return dp[a.length][b.length];
}

const builtins = [
  "print", "input", "len", "range", "str", "int", "float", "bool", "list",
  "dict", "set", "sum", "min", "max", "abs", "sorted", "type", "enumerate"
];

export function getFixSuggestionAndTrace(errorMessage, code) {
  const suggestions = [];
  let highlightLine = null;
  const match1 = errorMessage.match(/File "<stdin>", line (\d+)/);
  const match2 = errorMessage.match(/line (\d+), in <module>/);
  const match3 = errorMessage.match(/File "&lt;exec&gt;", line (\d+)/);
  const match4 = errorMessage.match(/File "<exec>", line (\d+)/);

  if (match1) highlightLine = parseInt(match1[1]);
  else if (match2) highlightLine = parseInt(match2[1]);
  else if (match3) highlightLine = parseInt(match3[1]);
  else if (match4) highlightLine = parseInt(match4[1]);
  console.log("HighlightLine from errortrace:", highlightLine);


  if (errorMessage.includes("AssertionError")) {
    const msgMatch = errorMessage.match(/AssertionError: (.+)/);
    const message = msgMatch ? msgMatch[1] : "";

    suggestions.push({
      suggestion: "Check the condition inside assert",
      explanation: message
        ? `Assertion failed with message: "${message}". The condition evaluated to False.`
        : "An assert statement failed. Check if your assumption or condition is valid.",
    });
  }

  if (errorMessage.includes("AttributeError") && /'(.+?)' object has no attribute '(.+?)'/.test(errorMessage)) {
    const [, objType, method] = errorMessage.match(/'(.+?)' object has no attribute '(.+?)'/);
    suggestions.push({
      suggestion: `Check if ${objType} supports .${method}()`,
      explanation: `You're trying to call .${method}() on a ${objType} — it may not exist.\n→ Maybe a typo? Or wrong type?`,
    });
  }

  if (errorMessage.includes("NameError") && /name '(.*?)' is not defined/.test(errorMessage)) {
    const match = errorMessage.match(/name '(.*?)' is not defined/);
    const undefinedName = match?.[1];

    let bestMatch = null;
    let minDistance = Infinity;

    for (const fn of builtins) {
      const dist = getLevenshteinDistance(fn, undefinedName);
      if (dist < minDistance && dist <= 2) {
        minDistance = dist;
        bestMatch = fn;
      }
    }

      if (bestMatch) {
        suggestions.push({
          suggestion: `Did you mean '${bestMatch}()'?`,
          explanation: `"${undefinedName}" is not defined. If it's a string, wrap it in quotes. Maybe you meant '${bestMatch}()'?`,
        });
      } else {
        suggestions.push({
          suggestion: `Define '${undefinedName}' or check spelling`,
          explanation: `You're using '${undefinedName}', but it's undefined. Assign it or quote it as a string.`,
        });
      }
    }

  if (errorMessage.includes("TypeError") && errorMessage.includes("unsupported operand type")) {
    suggestions.push({
      suggestion: `Use str() or int() to match data types`,
      explanation: `You're trying to operate on incompatible types. Try converting types first.`,
    });
  }

  if (errorMessage.includes("TypeError") && errorMessage.includes("object is not callable") && code.includes("str =")) {
    suggestions.push({
      suggestion: "Avoid naming variables after built-in functions",
      explanation: "`str = 5` overrides the built-in `str()` — use a different variable name.",
    });
  }

  if (errorMessage.includes("TypeError") && errorMessage.includes("can only concatenate")) {
    suggestions.push({
      suggestion: "Wrong operator precedence",
      explanation: "Convert types before combining",
    });
  }

  if (errorMessage.includes("TypeError") && errorMessage.includes("not callable")) {
    suggestions.push({
      suggestion: `You must use a variable name not same as a function.`,
      explanation: `Check if you're using function as a variable`,
    });
  }

  if (errorMessage.includes("TypeError") && errorMessage.includes("missing") && errorMessage.includes("required positional argument")) {
    suggestions.push({
      suggestion: "Check function call arguments",
      explanation: "You called a function without passing required arguments.",
    });
  }

  if (errorMessage.includes("ValueError")) {
    suggestions.push({
      suggestion: "Validate input or data format",
      explanation: "You passed an invalid value. Maybe check length, type, or input format.",
    });
  }

  if (errorMessage.includes("IndentationError")) {
    suggestions.push({
      suggestion: "Fix indentation levels (tabs/spaces mismatch)",
      explanation: "Python is sensitive to whitespace.\n→ Mixed tabs/spaces?\n→ Misaligned blocks?\n→ Forgot indentation after colon?",
    });
  }

  if (errorMessage.includes("ZeroDivisionError")) {
    suggestions.push({
      suggestion: "Make sure denominator is not zero",
      explanation: "You tried dividing by zero. That breaks math.",
    });
  }

  if (errorMessage.includes("IndexError")) {
    suggestions.push({
      suggestion: "Check index and list length",
      explanation: "You're accessing an index that doesn’t exist in a list or string.",
    });
  }
  if (errorMessage.includes("SyntaxError") && code.match(/\d+\.\s*\w+\s*\(/)) {
      suggestions.push({
        suggestion: "Don't call methods on numeric literals directly",
        explanation: "You tried `5.lower()` — Python thinks `5.` is a float. Assign it to a variable first or convert types properly.",
      });
    }
  if (errorMessage.includes("SyntaxError") && /print\s+["']/.test(code)) {
    suggestions.push({
      suggestion: "Use parentheses in function calls",
      explanation: "You may have missed `()` in `print()` — Python 3 requires them.",
    });
  }

  if (errorMessage.includes("SyntaxError") && /def\s+\w+\(\s*\d/.test(code)) {
    suggestions.push({
      suggestion: "Parameter names can't be numbers",
      explanation: "Function parameters must be valid variable names (e.g., `x`, `value`). You can't use numbers or invalid characters.",
    });
  }

  if (errorMessage.includes("SyntaxError") && errorMessage.includes("expected")) {
    suggestions.push({
      suggestion: "Indent the next line after a colon",
      explanation: "In Python, blocks under `if`, `for`, `def`, etc., must be indented.",
    });
  }

  if (errorMessage.includes("SyntaxError") && (
    errorMessage.includes("never closed") ||
    errorMessage.includes("unexpected EOF") ||
    errorMessage.includes("was never closed") ||
    errorMessage.includes("unterminated")
  )) {
    suggestions.push({
      suggestion: "You probably forgot to close something",
      explanation: "Check for missing '' quotations or missing brackets `()`, `[]`, `{}` or quotes `'`, `\"`. Python needs them to be closed properly.",
    });
  }

  if (errorMessage.includes("SyntaxError") && errorMessage.includes("invalid syntax")) {
    suggestions.push({
      suggestion: "Syntax seems off",
      explanation: "Check brackets, colons, and that all names and function definitions are valid.",
    });
  }

  if (errorMessage.includes("UnboundLocalError")) {
    suggestions.push({
      suggestion: "Define the variable before using it",
      explanation: "You used a variable in a function before assigning it — Python treats it as local.",
    });
  }

  if (errorMessage.includes("RecursionError")) {
    suggestions.push({
      suggestion: "Add a base case in your recursive function",
      explanation: "Your function calls itself forever — this causes a stack overflow.",
    });
  }
  if (errorMessage.includes("FloatingPointError")) {
    suggestions.push({
      suggestion: "Watch for divide-by-zero, overflow, or invalid math ops",
      explanation: `You’re performing a floating-point operation that caused an error.\n→ This often happens in NumPy if you divide by 0, overflow, or sqrt a negative number.`,
    });
  }

  const prettyTrace = errorMessage
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br/>') +
    (highlightLine ? `<br/><br/><span class="text-yellow-400">⚠️ Error on line ${highlightLine }</span>` : '');

  console.log("Highlight line detected:", highlightLine);

  return {
    traceHTML: `<div class="text-[10px] text-gray-400 mt-2 font-mono leading-tight">${prettyTrace}</div>`,
    suggestions,
    highlightLine
  };
}
