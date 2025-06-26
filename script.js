import { getFixSuggestion } from "./pyfixer.js";
let pyodide;
let oldDecorations = [];
const builtins = [
  "print", "input", "len", "range", "str", "int", "float", "bool", "list",
  "dict", "set", "sum", "min", "max", "abs", "sorted", "type", "enumerate"
];
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
async function init() {
  pyodide = await loadPyodide();
  document.getElementById("execute").addEventListener("click", runCode);
}
async function runCode() {
  const codeInput = window.editor.getValue();
  const outputDiv = document.getElementById("output");
  const tipsDiv = document.getElementById("python-tips");
  tipsDiv.innerHTML = "";

  const suggestion = getFixSuggestion(codeInput);
  if (suggestion) {
    tipsDiv.innerHTML = `<div class="text-yellow-300 font-semibold mb-1">Suggestion:</div>
      <div class="text-sm text-green-100 whitespace-pre-wrap font-mono">${suggestion.suggestion}</div>
      <div class="text-sm text-green-400 whitespace-pre-wrap font-mono mt-1">${suggestion.explanation}</div>`;
    return;
  }

  const inputMatches = [...codeInput.matchAll(/input\((.*?)\)/g)];
  if (inputMatches.length > 0) {
    handleInputs(codeInput, inputMatches, 0);
    return;
  }
  runFinalCode(codeInput);
}

function handleInputs(code, matches, i) {
  if (i >= matches.length) return runFinalCode(code);

  const modal = document.getElementById("inputModal");
  const inputField = document.getElementById("inputField");
  const promptText = document.getElementById("inputPrompt");
  const submitBtn = document.getElementById("submitInput");

  const question = matches[i][1]?.replaceAll(/['"]/g, "").trim() || "Enter value:";
  promptText.textContent = question;
  inputField.value = "";
  modal.classList.remove("hidden");

  submitBtn.onclick = null;
  submitBtn.addEventListener("click", () => {
    const userInput = inputField.value;
    modal.classList.add("hidden");
    const updatedCode = code.replace(matches[i][0], `"${userInput}"`);
    handleInputs(updatedCode, matches, i + 1);
  }, { once: true });
}

async function runFinalCode(code) {
  const outputDiv = document.getElementById("output");
  const tipsDiv = document.getElementById("python-tips");
  tipsDiv.innerHTML = "";  

  if (oldDecorations.length > 0) {
    oldDecorations = window.editor.deltaDecorations(oldDecorations, []);
  }

  try {
    const sanitizedCode = code.replace(/\\n/g, '\n');
    await pyodide.runPythonAsync(sanitizedCode);

    await pyodide.runPythonAsync(`
      import sys
      from io import StringIO
      sys.stdout = StringIO()
      ${code}
      output = sys.stdout.getvalue()
    `);

    const result = pyodide.globals.get("output");
    outputDiv.innerText = result || "Let's print() something!";
  } catch (err) {
      const message = err.toString();
      const suggestions = [];
    
      //match line number for highlighting
      let highlightLine = null;
      const match1 = message.match(/File "<stdin>", line (\d+)/);
      const match2 = message.match(/line (\d+), in <module>/);
      if (match1) highlightLine = parseInt(match1[1]);
      else if (match2) highlightLine = parseInt(match2[1]);

      if (message.includes("NameError") && /name '(.*?)' is not defined/.test(message)) {
        const match = message.match(/name '(.*?)' is not defined/);
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
            explanation: `"${undefinedName}" is not defined. if it is a string then quote it '',Looks like a typo — Python has a built-in called '${bestMatch}()'.`,
          });
        } else {
          suggestions.push({
            suggestion: `Define '${undefinedName}' or check spelling`,
            explanation: `You're trying to use '${undefinedName}', but it hasn't been defined. Either assign it, make it a string, or check if it's a typo.`,
          });
        }

      }

      if (message.includes("TypeError") && message.includes("unsupported operand type")) {
        suggestions.push({
          suggestion: `Use str() or int() to match data types`,
          explanation: `You're trying to operate on incompatible types. Try converting types first.`,
        });
      }
      if (message.includes("TypeError") && message.includes("object is not callable") && code.includes("str =")) {
        suggestions.push({
          suggestion: "Avoid naming variables after built-in functions",
          explanation: "`str = 5` overrides the built-in `str()` — use a different variable name.",
        });
      }
      if (message.includes("TypeError") && message.includes("can only concatenate")) {
        suggestions.push({
          suggestion: "Wrong operator precedence",
          explanation: "Convert types before combining",
        });
      }
      if (message.includes("TypeError") && message.includes("not callable")) {
        suggestions.push({
          suggestion: `You must use a variable name not same as a function.`,
          explanation: `Check if you're using function as a variable`,
        });
      }
      if (message.includes("TypeError") && message.includes("missing") && message.includes("required positional argument")) {
        suggestions.push({
          suggestion: "Check function call arguments",
          explanation: "You called a function without passing required arguments.",
        });
      }
      if (message.includes("ValueError")) {
        suggestions.push({
          suggestion: "Validate input or data format",
          explanation: "You passed an invalid value. Maybe check length, type, or input format.",
        });
      }
      if (message.includes("AttributeError") && /'(.+?)' object has no attribute '(.+?)'/.test(message)) {
        const [, objType, method] = message.match(/'(.+?)' object has no attribute '(.+?)'/);
        suggestions.push({
          suggestion: `Check if ${objType} supports .${method}()`,
          explanation: `You're trying to call .${method}() on a ${objType} — it may not exist.\n→ Maybe a typo? Or wrong type?`,
        });
      }
      if (message.includes("IndentationError")) {
        suggestions.push({
          suggestion: "Fix indentation levels (tabs/spaces mismatch)",
          explanation: "Python is sensitive to whitespace.\n→ Mixed tabs/spaces?\n→ Misaligned blocks?\n→ Forgot indentation after colon?",
        });
      }
      if (message.includes("ZeroDivisionError")) {
        suggestions.push({
          suggestion: "Make sure denominator is not zero",
          explanation: "You tried dividing by zero. That breaks math.",
        });
      }
      if (message.includes("IndexError")) {
        suggestions.push({
          suggestion: "Check index and list length",
          explanation: "You're accessing an index that doesn’t exist in a list or string.",
        });
      }
      if (message.includes("SyntaxError") && /print\s+["']/.test(code)) {
        suggestions.push({
          suggestion: "Use parentheses in function calls",
          explanation: "You may have missed `()` in `print()` — Python 3 requires them.",
        });
      }
      if (message.includes("SyntaxError") && /def\s+\w+\(\s*\d/.test(code)) {
        suggestions.push({
          suggestion: "Parameter names can't be numbers",
          explanation: "Function parameters must be valid variable names (e.g., `x`, `value`). You can't use numbers or invalid characters.",
        });
      }
      if (message.includes("SyntaxError") && message.includes("expected")) {
        suggestions.push({
          suggestion: "Indent the next line after a colon",
          explanation: "In Python, blocks under `if`, `for`, `def`, etc., must be indented.",
        });
      }
      if (message.includes("SyntaxError") && (
          message.includes("never closed") ||
          message.includes("unexpected EOF") ||
          message.includes("was never closed")||
          message.includes("unterminated")
      )) {
        suggestions.push({
          suggestion: "You probably forgot to close something",
          explanation: "Check for missing '' quotations or missing brackets `()`, `[]`, `{}` or quotes `'`, `\"`. Python needs them to be closed properly.",
        });
      }
      if (message.includes("SyntaxError") && message.includes("invalid syntax")) {
        suggestions.push({
          suggestion: "Syntax seems off",
          explanation: "Check brackets, colons, and that all names and function definitions are valid.",
        });
      }
      if (message.includes("UnboundLocalError")) {
        suggestions.push({
          suggestion: "Define the variable before using it",
          explanation: "You used a variable in a function before assigning it — Python treats it as local.",
        });
      }
      if (message.includes("RecursionError")) {
        suggestions.push({
          suggestion: "Add a base case in your recursive function",
          explanation: "Your function calls itself forever — this causes a stack overflow.",
        });
      }

    // Add highlighting
      if (highlightLine && window.editor && window.monaco) {
        oldDecorations = window.editor.deltaDecorations([], [
          {
            range: new monaco.Range(highlightLine, 1, highlightLine, 1),
            options: {
              isWholeLine: true,
              className: 'errorLineHighlight',
              glyphMarginClassName: 'errorGlyph',
            },
          },
        ]);
      }

      const prettyTrace = message
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('\n', '<br/>')
        + (highlightLine ? `<br/><br/><span class="text-yellow-400">⚠️ Error occurred on line ${highlightLine-4}</span>` : '');

      outputDiv.innerHTML = `<div class="text-[10px] text-gray-400 mt-2 font-mono leading-tight">${prettyTrace}</div>`;

      if (suggestions.length > 0) {
        const { suggestion, explanation } = suggestions[0];
        tipsDiv.innerHTML = `<div class="text-red-400 font-bold mb-1">FixyPy Calm Debugger</div>
          <div class="text-sm text-green-100 whitespace-pre-wrap font-mono mb-2">Suggestion: ${suggestion}<br/>${explanation}</div>`;
      } else {
        tipsDiv.innerHTML = `<div class="text-gray-500 text-sm italic font-mono">No tips this time. You got this!!</div>`;
      }

    }
}

init();