import { getFixSuggestion } from './pyfixer.js';

let pyodide;

async function init() {
  pyodide = await loadPyodide();
  

  const res = await fetch("fixer.html");
  const html = await res.text();

  // Inject fixer.html into page
  document.getElementById("app").innerHTML = html;

  // Attach event listener AFTER injection
  const executeBtn = document.getElementById("execute");
  executeBtn.addEventListener("click", runCode);
}

async function runCode() {
  const codeInput = document.getElementById("code").value;
  const outputDiv = document.getElementById("output");

  const suggestion = getFixSuggestion(codeInput);
  if (suggestion) {
    outputDiv.innerHTML = `
      <div class="text-yellow-300 font-semibold mb-1">💡 Suggestion:</div>
      <div class="text-sm text-green-100 whitespace-pre-wrap font-mono">${suggestion.suggestion}</div>
      <div class="text-sm text-green-400 whitespace-pre-wrap font-mono mt-1">${suggestion.explanation}</div>
    `;
    return;
  }

  let code = codeInput;
  const inputMatches = [...code.matchAll(/input\((.*?)\)/g)];

  if (inputMatches.length > 0) {
    handleInputs(code, inputMatches, 0);
    return;
  }

  runFinalCode(code);
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

  try {
    await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
${code}
output = sys.stdout.getvalue()
    `);
    const result = pyodide.globals.get("output");
    outputDiv.innerText = result || "No output.";
  } catch (err) {
    const message = err.toString();
    const suggestions = [];

    // NameError
    if (message.includes("NameError") && /name '(.+?)' is not defined/.test(message)) {
      const name = message.match(/name '(.+?)' is not defined/)[1];
      suggestions.push({
        suggestion: `"${name}" or ${name} = ...`,
        explanation: `NameError: '${name}' is not defined.\n→ Did you mean to make it a string?\n→ Or did you forget to assign it?`,
      });
    }

    // TypeError
    if (message.includes("TypeError") && message.includes("unsupported operand type")) {
      suggestions.push({
        suggestion: `Use str() or int() to match data types`,
        explanation: `You're trying to operate on incompatible types. Try converting types first.`,
      });
    }

    // ValueError
    if (message.includes("ValueError")) {
      suggestions.push({
        suggestion: "Validate input or data format",
        explanation: "You passed an invalid value. Maybe check length, type, or input format.",
      });
    }

    // AttributeError
    if (message.includes("AttributeError") && /'(.+?)' object has no attribute '(.+?)'/.test(message)) {
      const [, objType, method] = message.match(/'(.+?)' object has no attribute '(.+?)'/);
      suggestions.push({
        suggestion: `Check if ${objType} supports .${method}()`,
        explanation: `You're trying to call .${method}() on a ${objType} — it may not exist.\n→ Maybe a typo? Or wrong type?`,
      });
    }

    // SyntaxError
    if (message.includes("SyntaxError")) {
      suggestions.push({
        suggestion: "Check line endings, colons, or indentation",
        explanation: "There’s a syntax issue — maybe you missed a colon or bracket.",
      });
    }

    // ZeroDivisionError
    if (message.includes("ZeroDivisionError")) {
      suggestions.push({
        suggestion: "Make sure denominator is not zero",
        explanation: "You tried dividing by zero. That breaks math.",
      });
    }

    // IndexError
    if (message.includes("IndexError")) {
      suggestions.push({
        suggestion: "Check index and list length",
        explanation: "You're accessing an index that doesn’t exist in a list or string.",
      });
    }

    const prettyTrace = message
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\n', '<br/>');

    if (suggestions.length > 0) {
      const { suggestion, explanation } = suggestions[0];
      outputDiv.innerHTML = `
        <div class="text-red-400 font-bold mb-1">FixyPy Calm Debugger</div>
        <div class="text-sm text-green-100 whitespace-pre-wrap font-mono mb-2">
          Suggestion: ${suggestion}<br/>
          ${explanation}
        </div>
        <div class="text-[10px] text-gray-400 mt-2 font-mono leading-tight">
          ${prettyTrace}
        </div>
      `;
    } else {
      outputDiv.innerHTML = `
        <div class="text-red-400 font-bold mb-1">Python Error</div>
        <div class="text-[10px] text-gray-400 mt-2 font-mono leading-tight">
          ${prettyTrace}
        </div>
      `;
    }
  }
}

init();
