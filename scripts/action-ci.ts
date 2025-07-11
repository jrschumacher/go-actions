import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { extractCoverage } from './coverage-extractor';
import { runBenchmarks } from './benchmark-runner';
import { UnifiedPRComment } from './unified-pr-comment';

export type CIJobType = 'test' | 'lint' | 'benchmark';

export interface CIJobInputs {
  job: CIJobType;
  goVersion?: string;
  goVersionFile?: string;
  workingDirectory?: string;
  
  // Test-specific
  testArgs?: string;
  
  // Lint-specific  
  golangciLintVersion?: string;
  lintArgs?: string;
  
  // Benchmark-specific
  benchmarkArgs?: string;
  benchmarkCount?: number;
}

/**
 * Runs the specified CI job (test, lint, or benchmark)
 * Consolidates all CI logic in one place for better testing and maintenance
 */
export async function runCIJob(inputs: CIJobInputs): Promise<void> {
  try {
    // Validate job input
    const validJobs: CIJobType[] = ['test', 'lint', 'benchmark'];
    if (!validJobs.includes(inputs.job)) {
      throw new Error(`Invalid job type: ${inputs.job}. Valid options are: ${validJobs.join(', ')}`);
    }

    console.log(`Running CI job: ${inputs.job}`);

    switch (inputs.job) {
      case 'test':
        await runTestJob(inputs);
        break;
      case 'lint':
        await runLintJob(inputs);
        break;
      case 'benchmark':
        await runBenchmarkJob(inputs);
        break;
    }

  } catch (error) {
    console.error(`CI job '${inputs.job}' failed:`, error);
    core.setFailed(`CI job '${inputs.job}' failed: ${error}`);
    throw error;
  }
}

async function runTestJob(inputs: CIJobInputs): Promise<void> {
  const workingDir = inputs.workingDirectory || '.';
  const testArgs = inputs.testArgs || '-v -race -coverprofile=coverage.out';
  
  console.log('Running Go tests...');
  
  try {
    // Run tests
    await exec.exec('go', ['test', ...testArgs.split(' '), './...'], {
      cwd: workingDir
    });
    
    // Extract coverage
    const result = extractCoverage(workingDir);
    
    if (result.hasCoverage && result.coverage !== null) {
      console.log(`Coverage: ${result.coverage}%`);
      core.setOutput('coverage', result.coverage.toString());
    } else {
      console.log('No coverage data found');
      core.setOutput('coverage', '0');
    }
    
    // Store test results for unified comment
    const testResult = {
      status: 'success' as const,
      coverage: result.hasCoverage && result.coverage !== null ? `${result.coverage}%` : undefined,
    };
    
    await UnifiedPRComment.storeResults('test', testResult);
    console.log('Stored test results for unified comment');
    
  } catch (error) {
    // Store failure results
    const testResult = {
      status: 'failure' as const,
      error: 'Test execution failed'
    };
    
    await UnifiedPRComment.storeResults('test', testResult);
    throw error;
  }
}

async function runBenchmarkJob(inputs: CIJobInputs): Promise<void> {
  const workingDir = inputs.workingDirectory || '.';
  const benchmarkArgs = inputs.benchmarkArgs || '-bench=. -benchmem';
  const benchmarkCount = inputs.benchmarkCount || 5;
  
  try {
    const result = runBenchmarks(workingDir, benchmarkArgs, benchmarkCount);
    console.log('Benchmark results:', result);
    
    // Store benchmark results for unified comment
    const benchmarkResult = {
      status: 'success' as const,
      config: {
        args: benchmarkArgs,
        count: benchmarkCount
      }
    };
    
    await UnifiedPRComment.storeResults('benchmark', benchmarkResult);
    console.log('Stored benchmark results for unified comment');
    
  } catch (error) {
    // Store failure results
    const benchmarkResult = {
      status: 'failure' as const,
      error: (error as Error).message,
      config: {
        args: benchmarkArgs,
        count: benchmarkCount
      }
    };
    
    await UnifiedPRComment.storeResults('benchmark', benchmarkResult);
    throw error;
  }
}

async function runLintJob(inputs: CIJobInputs): Promise<void> {
  const workingDir = inputs.workingDirectory || '.';
  let golangciLintVersion = inputs.golangciLintVersion || 'v2.1.0';
  const lintArgs = inputs.lintArgs || '';
  
  // Normalize golangci-lint version
  if (golangciLintVersion === 'v2' || golangciLintVersion === 'latest') {
    golangciLintVersion = 'v2.1.0';
  }
  
  console.log(`Using golangci-lint version: ${golangciLintVersion}`);
  
  try {
    // Since we can't easily replicate the golangci-lint-action@v8 behavior in TypeScript,
    // we'll use the golangci-lint binary directly
    console.log('Installing and running golangci-lint...');
    
    // Install golangci-lint
    await exec.exec('go', ['install', `github.com/golangci/golangci-lint/cmd/golangci-lint@${golangciLintVersion}`]);
    
    // Run golangci-lint
    const lintCommand = ['golangci-lint', 'run'];
    if (lintArgs) {
      lintCommand.push(...lintArgs.split(' '));
    }
    
    await exec.exec(lintCommand[0], lintCommand.slice(1), {
      cwd: workingDir
    });
    
    // Store successful lint results
    const lintResult = {
      status: 'success' as const
    };
    
    await UnifiedPRComment.storeResults('lint', lintResult);
    console.log('Stored lint results for unified comment');
    
  } catch (error) {
    // Store failure results
    const lintResult = {
      status: 'failure' as const,
      error: 'Linting issues found - check logs for details'
    };
    
    await UnifiedPRComment.storeResults('lint', lintResult);
    throw error;
  }
}

// Default export for simple function call
export default async function() {
  const inputs: CIJobInputs = {
    job: (process.env.INPUT_JOB as CIJobType) || 'test',
    goVersion: process.env.INPUT_GO_VERSION,
    goVersionFile: process.env.INPUT_GO_VERSION_FILE,
    workingDirectory: process.env.INPUT_WORKING_DIRECTORY,
    testArgs: process.env.INPUT_TEST_ARGS,
    golangciLintVersion: process.env.INPUT_GOLANGCI_LINT_VERSION,
    lintArgs: process.env.INPUT_LINT_ARGS,
    benchmarkArgs: process.env.INPUT_BENCHMARK_ARGS,
    benchmarkCount: process.env.INPUT_BENCHMARK_COUNT ? parseInt(process.env.INPUT_BENCHMARK_COUNT) : undefined,
  };
  
  await runCIJob(inputs);
}