import { extractCoverage, CoverageResult } from './coverage-extractor';
import { runBenchmarks, BenchmarkResult } from './benchmark-runner';
import { storeJobResults } from './unified-pr-comment';
import * as core from '@actions/core';
import * as github from '@actions/github';

export interface CIActionOptions {
  workingDirectory?: string;
  job?: string;
  benchmarkArgs?: string;
  benchmarkCount?: number;
}

export class CIAction {
  private workingDirectory: string;
  private job: string;
  private benchmarkArgs: string;
  private benchmarkCount: number;

  constructor(options: CIActionOptions = {}) {
    this.workingDirectory = options.workingDirectory || '.';
    this.job = options.job || 'test';
    this.benchmarkArgs = options.benchmarkArgs || '-bench=. -benchmem';
    this.benchmarkCount = options.benchmarkCount || 1;
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


  getInputs() {
    return {
      job: core.getInput('job') || 'test',
      workingDirectory: core.getInput('working-directory') || '.',
      benchmarkArgs: core.getInput('benchmark-args') || '-bench=. -benchmem',
      benchmarkCount: parseInt(core.getInput('benchmark-count') || '1'),
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

