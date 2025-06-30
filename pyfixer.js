const builtins = ["str", "int", "float", "list", "dict", "set", "bool", "sum", "min", "max", "print"];

export function fixSyntaxIssues(code) {
  const lines = code.split("\n");
  const fixes = [];
  const warnings = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalLine = line; // store original
    let fixedLine = line;

    // Example: fix unquoted input prompt
    const inputMatch = line.match(/input\(([^'"].*?)\)/);
    if (inputMatch) {
      const prompt = inputMatch[1];
      fixes.push(`Line ${i + 1}: Quoted input() prompt → input("${prompt}")`);
    }

    // Example: print without parentheses
    const printMatch = line.match(/^\s*print\s+['"][^)]*$/);
    if (printMatch) {
      fixes.push(`Line ${i + 1}: Missing parentheses in print — Did you mean print(...) ?`);
    }

    // Example: built-in override warning
    const overrideMatch = line.match(/\b(str|list|dict|input|print)\s*=/);
    if (overrideMatch) {
      warnings.push(`Line ${i + 1}: Overwriting Python built-in: '${overrideMatch[1]}'`);
    }
  }

  return {
    fixedCode: code, 
    fixes,
    warnings,
  };
}

