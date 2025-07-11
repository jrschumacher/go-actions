import { extractCoverage, CoverageResult } from './coverage-extractor';
import { runBenchmarks, BenchmarkResult } from './benchmark-runner';
import { storeJobResults } from './unified-pr-comment';
import * as core from '@actions/core';
import * as github from '@actions/github';

export interface CIActionOptions {
  workingDirectory?: string;
  job?: string;
  testArgs?: string;
  golangciLintVersion?: string;
  lintArgs?: string;
  benchmarkArgs?: string;
  benchmarkCount?: number;
}

export class CIAction {
  private workingDirectory: string;
  private job: string;
  private testArgs: string;
  private golangciLintVersion: string;
  private lintArgs: string;
  private benchmarkArgs: string;
  private benchmarkCount: number;

  constructor(options: CIActionOptions = {}) {
    this.workingDirectory = options.workingDirectory || '.';
    this.job = this.validateJob(options.job || 'test');
    this.testArgs = options.testArgs || '-v -race -coverprofile=coverage.out';
    this.golangciLintVersion = options.golangciLintVersion || 'v2.1.0';
    this.lintArgs = options.lintArgs || '';
    this.benchmarkArgs = options.benchmarkArgs || '-bench=. -benchmem';
    this.benchmarkCount = options.benchmarkCount || 5;
  }

  /**
   * Validates that the job type is valid
   */
  private validateJob(job: string): string {
    const validJobs = ['test', 'lint', 'benchmark'];
    if (!validJobs.includes(job)) {
      const message = `Invalid job type: ${job}. Valid options are: ${validJobs.join(', ')}`;
      core.setFailed(message);
      throw new Error(message);
    }
    return job;
  }

  async extractTestCoverage(): Promise<CoverageResult> {
    if (this.job !== 'test') {
      return { coverage: null, hasCoverage: false };
    }

    console.log('Extracting test coverage...');
    const result = extractCoverage(this.workingDirectory);
    
    if (result.hasCoverage && result.coverage) {
      console.log(`Test coverage: ${result.coverage}`);
      core.setOutput('coverage', result.coverage);
      core.setOutput('has_coverage', 'true');
      
      // Store results for unified comment
      await storeJobResults('test', {
        status: 'success' as const,
        coverage: result.coverage
      });
    } else {
      console.log('No coverage file found');
      core.setOutput('has_coverage', 'false');
      
      // Store results for unified comment
      await storeJobResults('test', {
        status: 'success' as const
      });
    }

    return result;
  }

  async runBenchmarks(): Promise<BenchmarkResult> {
    if (this.job !== 'benchmark') {
      return { success: false, error: 'Job is not benchmark' };
    }

    console.log('Running Go benchmarks...');
    console.log(`Benchmark configuration: ${this.benchmarkArgs}, ${this.benchmarkCount} runs`);
    
    const result = runBenchmarks(this.workingDirectory, this.benchmarkArgs, this.benchmarkCount);
    
    if (result.success) {
      console.log('✅ Benchmarks completed successfully');
      core.setOutput('benchmark_success', 'true');
      
      // Store results for unified comment
      await storeJobResults('benchmark', {
        status: 'success' as const,
        config: {
          args: this.benchmarkArgs,
          count: this.benchmarkCount
        }
      });
    } else {
      console.log(`❌ Benchmarks failed: ${result.error}`);
      core.setOutput('benchmark_success', 'false');
      core.setOutput('benchmark_error', result.error || 'Unknown error');
      core.setFailed(`Benchmark failed: ${result.error}`);
      
      // Store results for unified comment
      await storeJobResults('benchmark', {
        status: 'failure' as const,
        config: {
          args: this.benchmarkArgs,
          count: this.benchmarkCount
        },
        error: result.error
      });
    }

    return result;
  }

  /**
   * Handles lint job result storage
   */
  async storeLintResults(lintOutcome: string): Promise<void> {
    if (this.job !== 'lint') {
      console.log('Skipping lint result storage - job is not lint');
      return;
    }

    console.log(`Storing lint results with outcome: ${lintOutcome}`);
    
    const lintResult = {
      status: lintOutcome === 'success' ? 'success' as const : 'failure' as const,
      error: lintOutcome !== 'success' ? 'Linting issues found - check logs for details' : undefined
    };

    await storeJobResults('lint', lintResult);
    console.log('✅ Lint results stored for unified comment');
  }

  /**
   * Gets the golangci-lint version for this job
   */
  getGolangciLintVersion(): string {
    return this.golangciLintVersion;
  }

  /**
   * Normalizes golangci-lint version for compatibility with golangci-lint-action@v8
   * Converts generic v2/latest to specific v2.1.0
   */
  normalizeGolangciLintVersion(version?: string): string {
    const versionToNormalize = version || this.golangciLintVersion;
    
    if (versionToNormalize === 'v2' || versionToNormalize === 'latest') {
      return 'v2.1.0';
    }
    
    return versionToNormalize;
  }

  /**
   * Gets the lint args for this job
   */
  getLintArgs(): string {
    return this.lintArgs;
  }

  /**
   * Gets the test args for this job
   */
  getTestArgs(): string {
    return this.testArgs;
  }

  /**
   * Logs the current job configuration
   */
  logConfiguration(): void {
    console.log('CI Action Configuration:');
    console.log(`- Job: ${this.job}`);
    console.log(`- Working directory: ${this.workingDirectory}`);
    
    if (this.job === 'test') {
      console.log(`- Test args: ${this.testArgs}`);
    } else if (this.job === 'lint') {
      console.log(`- golangci-lint version: ${this.golangciLintVersion}`);
      console.log(`- Lint args: ${this.lintArgs || 'default'}`);
    } else if (this.job === 'benchmark') {
      console.log(`- Benchmark args: ${this.benchmarkArgs}`);
      console.log(`- Benchmark count: ${this.benchmarkCount}`);
    }
  }

  getInputs() {
    return {
      job: core.getInput('job') || 'test',
      workingDirectory: core.getInput('working-directory') || '.',
      testArgs: core.getInput('test-args') || '-v -race -coverprofile=coverage.out',
      golangciLintVersion: core.getInput('golangci-lint-version') || 'v2.1.0',
      lintArgs: core.getInput('lint-args') || '',
      benchmarkArgs: core.getInput('benchmark-args') || '-bench=. -benchmem',
      benchmarkCount: parseInt(core.getInput('benchmark-count') || '5'),
    };
  }
}

// Export functions for direct use
export async function extractTestCoverage(workingDirectory?: string): Promise<CoverageResult> {
  const action = new CIAction({ workingDirectory, job: 'test' });
  return action.extractTestCoverage();
}

export async function runBenchmarkJob(workingDirectory?: string, benchmarkArgs?: string, benchmarkCount?: number): Promise<BenchmarkResult> {
  const action = new CIAction({ 
    workingDirectory, 
    job: 'benchmark', 
    benchmarkArgs, 
    benchmarkCount 
  });
  return action.runBenchmarks();
}

export async function storeLintResults(lintOutcome: string, workingDirectory?: string): Promise<void> {
  const action = new CIAction({ workingDirectory, job: 'lint' });
  return action.storeLintResults(lintOutcome);
}

export function validateJobInput(job: string): string {
  const action = new CIAction({ job });
  return job; // If we get here, validation passed
}

