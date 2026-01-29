import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

export interface CoverageResult {
  coverage: string | null;
  hasCoverage: boolean;
  percentage?: number;
  meetsThreshold?: boolean;
}

interface CoverageOptions {
  workingDirectory: string;
  coverageFile?: string;
  threshold?: number;
}

/**
 * Validates that a coverage file name is safe (no path traversal or shell injection)
 */
function validateCoverageFileName(fileName: string): boolean {
  // Only allow alphanumeric, dots, hyphens, and underscores
  const safePattern = /^[\w.-]+$/;
  // Prevent path traversal
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return false;
  }
  return safePattern.test(fileName);
}

export class CoverageExtractor {
  private workingDir: string;
  private coverageFile: string;
  private threshold: number;

  constructor(options: CoverageOptions) {
    this.workingDir = options.workingDirectory;
    const coverageFile = options.coverageFile || 'coverage.out';

    // Validate coverage file name to prevent injection
    if (!validateCoverageFileName(coverageFile)) {
      throw new Error(`Invalid coverage file name: ${coverageFile}. Only alphanumeric characters, dots, hyphens, and underscores are allowed.`);
    }
    this.coverageFile = coverageFile;
    this.threshold = options.threshold || 0;
  }

  public extractCoverage(): CoverageResult {
    const coveragePath = path.join(this.workingDir, this.coverageFile);

    if (!fs.existsSync(coveragePath)) {
      console.log('No coverage file found');
      return { coverage: null, hasCoverage: false };
    }

    try {
      // Use spawnSync with array arguments to prevent command injection
      const result = spawnSync('go', ['tool', 'cover', `-func=${this.coverageFile}`], {
        cwd: this.workingDir,
        encoding: 'utf8'
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error(result.stderr || 'go tool cover failed');
      }

      // Parse the output in JavaScript instead of using shell pipes
      // Looking for the line containing "total:" and extracting the percentage
      const output = result.stdout;
      const coverage = this.extractCoverageFromOutput(output);
      const percentage = this.parseCoveragePercentage(coverage);

      console.log(`Test coverage: ${coverage}`);

      // Check threshold if configured
      let meetsThreshold = true;
      if (this.threshold > 0 && percentage !== null) {
        meetsThreshold = percentage >= this.threshold;
        if (!meetsThreshold) {
          console.log(`Coverage ${percentage.toFixed(1)}% is below threshold ${this.threshold}%`);
        } else {
          console.log(`Coverage ${percentage.toFixed(1)}% meets threshold ${this.threshold}%`);
        }
      }

      return {
        coverage,
        hasCoverage: true,
        percentage: percentage !== null ? percentage : undefined,
        meetsThreshold
      };
    } catch (error) {
      console.log('Failed to extract coverage information');
      console.log(`Error: ${error}`);
      return { coverage: null, hasCoverage: false };
    }
  }

  /**
   * Extracts the coverage percentage from go tool cover output
   * Replaces shell piping: grep total | awk '{print $3}'
   */
  private extractCoverageFromOutput(output: string): string {
    const lines = output.split('\n');
    const totalLine = lines.find(line => line.includes('total:'));

    if (!totalLine) {
      return output.trim(); // Return raw output if no total line found
    }

    // Extract the percentage (last field in the line)
    const fields = totalLine.trim().split(/\s+/);
    const percentage = fields[fields.length - 1];

    return percentage || output.trim();
  }

  /**
   * Parse coverage percentage string to number
   * @param coverage Coverage string (e.g., "85.3%")
   * @returns Numeric percentage or null if parsing fails
   */
  private parseCoveragePercentage(coverage: string): number | null {
    const match = coverage.match(/^(\d+\.?\d*)%?$/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }
}

// Main execution for github-script
export function extractCoverage(
  workingDirectory: string = '.',
  coverageFile: string = 'coverage.out',
  threshold: number = 0
): CoverageResult {
  const extractor = new CoverageExtractor({ workingDirectory, coverageFile, threshold });
  return extractor.extractCoverage();
}