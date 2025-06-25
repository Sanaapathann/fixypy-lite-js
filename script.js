import { getFixSuggestion } from './pyfixer.js';

let pyodide;
let oldDecorations = [];

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
    tipsDiv.innerHTML = `
      <div class="text-yellow-300 font-semibold mb-1">Suggestion:</div>
      <div class="text-sm text-green-100 whitespace-pre-wrap font-mono">${suggestion.suggestion}</div>
      <div class="text-sm text-green-400 whitespace-pre-wrap font-mono mt-1">${suggestion.explanation}</div>
    `;

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
  if (i >= matches.length) {
    runFinalCode(code);
    return;
  }

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

  //clear old highlights
  if (oldDecorations.length > 0) {
    oldDecorations = window.editor.deltaDecorations(oldDecorations, []);
  }

  try {
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

    //suggestions
    if (message.includes("NameError") && /name '(.+?)' is not defined/.test(message)) {
      const name = message.match(/name '(.+?)' is not defined/)[1];
      suggestions.push({
        suggestion: `"${name}" or ${name} = ...`,
        explanation: `NameError: '${name}' is not defined.\n→ Did you mean to make it a string?\n→ Or did you forget to assign it?`,
      });
    }

    if (message.includes("TypeError") && message.includes("unsupported operand type")) {
      suggestions.push({
        suggestion: `Use str() or int() to match data types`,
        explanation: `You're trying to operate on incompatible types. Try converting types first.`,
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

    if (message.includes("SyntaxError")) {
      suggestions.push({
        suggestion: "Check line endings, colons, or indentation",
        explanation: "There’s a syntax issue — maybe you missed a colon or bracket.",
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