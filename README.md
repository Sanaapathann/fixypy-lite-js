# 🐍 FixyPy

**FixyPy** is a calm, beginner-focused Python editor that runs entirely in your browser using **Pyodide** - no installs, no servers.

It doesn't generate full AI answers. Instead, FixyPy uses **regex-based error tracing**, **pattern recognition**, and gentle suggestions to help you learn from your mistakes.

This tool is built for learners who want to understand logic without panic - through small nudges, highlighted errors, and meaningful hints.

## ✨ Features

- ✅ Suggests solutions for common Python errors  
- ✅ Explains mistakes in beginner-friendly language  
- ✅ Highlights the exact line of error using **Monaco Editor**  
- ✅ Handles `input()` by prompting interactively in the browser  
- ✅ Works entirely in your browser - no setup needed

---

## ⚙️ How It Works

FixyPy uses:

- 🧠 **Regex + Pattern Matching** - To detect Python errors and suggest relevant hints  
- 🧪 **Pyodide** - To run Python code right in the browser  
- 🎨 **Monaco Editor** - To enable real-time highlighting of error lines  
- 🌈 **TailwindCSS** - For clean, readable UI with calm visual design

Although FixyPy runs Python, it’s actually built with a modern web stack under the hood - proving that browser-based coding tools can be powerful and lightweight.

---

## 🎯 Why FixyPy?

FixyPy is inspired by learning psychology. Beginners often get discouraged by cryptic error messages and overwhelming AI suggestions. FixyPy keeps things simple:

- You write your own code  
- If there’s an issue, FixyPy nudges you gently  
- No AI-overwriting your work - just **you**, your logic, and calm guidance

> FixyPy doesn’t fix it for you. It helps **you** fix it peacefully.

---

## 🚀 Try It Live

**[🔗 Fixypy](https://fixypy.vercel.app)** (hosted via Vercel)

🌱 Future Ideas
**More Regex-Based Suggestions**
Expand FixyPy’s pattern-matching engine to catch additional Python errors like:
1 ModuleNotFoundError
2 UnboundLocalError
3 KeyError, RecursionError, ImportError
(This will improve confidence without relying on AI.)

**Better Traceback Parsing**
1 Enhance multi-line error trace extraction to support:
2 Nested functions
3 Class-based stack traces
4 Tracebacks from try-except blocks

---

## 🛠️ Local Setup...

```bash
git clone https://github.com/Sanaapathann/fixypy-lite-js.git
