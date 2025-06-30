import { fixSyntaxIssues } from "./pyfixer.js";
import { getFixSuggestionAndTrace } from './errortrace.js';

let pyodide;
let oldDecorations = [];

async function init() {
  pyodide = await loadPyodide();
  document.getElementById("execute").addEventListener("click", runCode);
}

async function runCode() {
  let codeInput = window.editor.getValue();
  const outputDiv = document.getElementById("output");
  const tipsDiv = document.getElementById("python-tips");
  tipsDiv.innerHTML = "";

  // Run syntax fixer
  const { fixedCode, fixes, warnings } = fixSyntaxIssues(codeInput);
  codeInput = fixedCode;

  const syntaxTipsHTML = (fixes.length > 0 || warnings.length > 0) ? `<div class="text-yellow-300 font-semibold mb-1">FixyPy Syntax Pings:</div>
  <ul class="text-sm text-green-200 font-mono list-disc pl-4">${fixes.map(f => `<li>${f}</li>`).join("")}</ul>
    ${warnings.length > 0 ? `<div class="mt-2 text-orange-300 font-semibold">Warnings:</div>
    <ul class="text-sm text-orange-200 font-mono list-disc pl-4">${warnings.map(w => `<li>${w}</li>`).join("")}</ul>` : ""}
  ` : "";

  // Check for input() prompts
  const inputMatches = [...codeInput.matchAll(/input\((.*?)\)/g)];
  if (inputMatches.length > 0) {
    handleInputs(codeInput, inputMatches, 0, syntaxTipsHTML);
    return;
  }

  runFinalCode(codeInput, syntaxTipsHTML);
}

function handleInputs(code, matches, i, tipsHTML = "") {
  if (i >= matches.length) return runFinalCode(code, tipsHTML);

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
    handleInputs(updatedCode, matches, i + 1, tipsHTML);
  }, { once: true });
}

async function runFinalCode(code, tipsHTML = "") {
  const outputDiv = document.getElementById("output");
  const tipsDiv = document.getElementById("python-tips");
  tipsDiv.innerHTML = tipsHTML;

  if (oldDecorations.length > 0) {
    oldDecorations = window.editor.deltaDecorations(oldDecorations, []);
  }

  try {
    const sanitizedCode = code;

    await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
`);

    await pyodide.runPythonAsync(sanitizedCode);

    const result = await pyodide.runPythonAsync("sys.stdout.getvalue()");
    outputDiv.textContent  = result || "Let's print() something!";
  } catch (err) {
    const errorMessage = err.toString();
    const { traceHTML, suggestions, highlightLine } = getFixSuggestionAndTrace(errorMessage, code);

 if (errorMessage.includes("ImportError") || errorMessage.includes("ModuleNotFoundError")) {
  const match = errorMessage.match(/(?:No module named|The module).*?['"](.+?)['"]/);
  if (match) {
    const missingModule = match[1];
    outputDiv.innerText = `⚙️ Trying to load or install '${missingModule}'...`;

    try {
      // Pyodide-bundled modules like numpy
      await pyodide.loadPackage(missingModule);
      outputDiv.innerText += `\n✅ Loaded '${missingModule}' with pyodide.loadPackage. Retrying...`;
      await runFinalCode(code);
      return;
    } catch {
      try {
        // For pure Python micropip-installable packages
        await pyodide.runPythonAsync(`
          import micropip
          await micropip.install("${missingModule}")
        `);
        outputDiv.innerText += `\n✅ Installed '${missingModule}' using micropip. Retrying...`;
        await runFinalCode(code);
        return;
      } catch (installErr) {
        outputDiv.innerText += `\n❌ Could not install '${missingModule}': ${installErr}`;
        tipsDiv.innerHTML += `
          <div class="text-red-400 font-bold mt-4 mb-1">FixyPy Calm Debugger</div>
          <div class="text-sm text-orange-200 font-mono">
            The module <strong>'${missingModule}'</strong> is either not supported by Pyodide or requires system-level dependencies.<br/>
            This browser-based Python environment can only run modules compatible with WebAssembly.
          </div>`;
      }
    }
  }
}


    if (highlightLine && window.editor && window.monaco) {
      oldDecorations = window.editor.deltaDecorations([], [
        {
          range: new monaco.Range(highlightLine, 1, highlightLine, 1),
          options: {
            isWholeLine: true,
            className: 'errorLineHighlight',
          },
        },
      ]);
    }

    outputDiv.innerHTML = traceHTML;

    if (suggestions.length > 0) {
      const { suggestion, explanation } = suggestions[0];
      tipsDiv.innerHTML += `<div class="text-red-400 font-bold mt-4 mb-1">FixyPy Calm Debugger</div>
        <div class="text-sm text-green-100 whitespace-pre-wrap font-mono mb-2">Suggestion: ${suggestion}<br/>${explanation}</div>`;
    } else {
      tipsDiv.innerHTML += `<div class="text-gray-500 text-sm italic font-mono mt-4">No tips this time. You got this!!</div>`;
    }
  }
}

init();
