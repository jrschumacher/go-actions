import { spawnSync } from 'child_process';

interface BenchmarkOptions {
  workingDirectory: string;
  benchmarkArgs: string;
  benchmarkCount: number;
}

export interface BenchmarkResult {
  success: boolean;
  error?: string;
}

/**
 * Dangerous shell metacharacters that should not appear in benchmark arguments
 */
const DANGEROUS_PATTERNS = [
  /[;&|`$(){}[\]<>!]/,  // Shell metacharacters
  /\.\./,               // Path traversal
  /\n|\r/,              // Newlines (command injection)
];

/**
 * Validates that benchmark arguments don't contain shell injection patterns
 */
function validateBenchmarkArgs(args: string): void {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(args)) {
      throw new Error(`Invalid benchmark arguments: contains potentially dangerous characters. Arguments: ${args}`);
    }
  }
}

/**
 * Safely parses benchmark arguments string into an array
 * Handles quoted strings and respects whitespace boundaries
 */
function parseBenchmarkArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of argsString) {
    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

export class BenchmarkRunner {
  private workingDir: string;
  private benchmarkArgs: string[];
  private benchmarkCount: number;

  constructor(options: BenchmarkOptions) {
    this.workingDir = options.workingDirectory;

    // Validate benchmark args before parsing
    validateBenchmarkArgs(options.benchmarkArgs);

    // Parse the benchmark args string into an array for safe execution
    this.benchmarkArgs = parseBenchmarkArgs(options.benchmarkArgs);
    this.benchmarkCount = options.benchmarkCount;
  }

  public runBenchmarks(): BenchmarkResult {
    console.log('Running Go benchmarks...');

    try {
      for (let i = 1; i <= this.benchmarkCount; i++) {
        console.log(`Benchmark run ${i}/${this.benchmarkCount}`);

        // Use spawnSync with array arguments to prevent command injection
        const result = spawnSync('go', ['test', ...this.benchmarkArgs, './...'], {
          cwd: this.workingDir,
          stdio: 'inherit'
        });

        if (result.error) {
          throw result.error;
        }

        if (result.status !== 0) {
          throw new Error(`go test exited with status ${result.status}`);
        }
      }

      console.log('✅ All benchmark runs completed successfully');
      return { success: true };
    } catch (error) {
      console.log('❌ Benchmark run failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Main execution for github-script
export function runBenchmarks(
  workingDirectory: string = '.', 
  benchmarkArgs: string = '-bench=. -benchmem', 
  benchmarkCount: number = 5
): BenchmarkResult {
  const runner = new BenchmarkRunner({ workingDirectory, benchmarkArgs, benchmarkCount });
  return runner.runBenchmarks();
}