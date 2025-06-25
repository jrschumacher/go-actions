import { execSync } from 'child_process';

interface BenchmarkOptions {
  workingDirectory: string;
  benchmarkArgs: string;
  benchmarkCount: number;
}

export interface BenchmarkResult {
  success: boolean;
  error?: string;
}

export class BenchmarkRunner {
  private workingDir: string;
  private benchmarkArgs: string;
  private benchmarkCount: number;

  constructor(options: BenchmarkOptions) {
    this.workingDir = options.workingDirectory;
    this.benchmarkArgs = options.benchmarkArgs;
    this.benchmarkCount = options.benchmarkCount;
  }

  public runBenchmarks(): BenchmarkResult {
    console.log('Running Go benchmarks...');
    
    try {
      for (let i = 1; i <= this.benchmarkCount; i++) {
        console.log(`Benchmark run ${i}/${this.benchmarkCount}`);
        
        execSync(`go test ${this.benchmarkArgs} ./...`, {
          cwd: this.workingDir,
          stdio: 'inherit'
        });
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