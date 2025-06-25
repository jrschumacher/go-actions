import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CoverageResult {
  coverage: string | null;
  hasCoverage: boolean;
}

interface CoverageOptions {
  workingDirectory: string;
  coverageFile?: string;
}

export class CoverageExtractor {
  private workingDir: string;
  private coverageFile: string;

  constructor(options: CoverageOptions) {
    this.workingDir = options.workingDirectory;
    this.coverageFile = options.coverageFile || 'coverage.out';
  }

  public extractCoverage(): CoverageResult {
    const coveragePath = path.join(this.workingDir, this.coverageFile);
    
    if (!fs.existsSync(coveragePath)) {
      console.log('No coverage file found');
      return { coverage: null, hasCoverage: false };
    }

    try {
      const result = execSync(`go tool cover -func=${this.coverageFile} | grep total | awk '{print $3}'`, {
        cwd: this.workingDir,
        encoding: 'utf8'
      });
      
      const coverage = result.trim();
      console.log(`Test coverage: ${coverage}`);
      
      return { coverage, hasCoverage: true };
    } catch (error) {
      console.log('Failed to extract coverage information');
      console.log(`Error: ${error}`);
      return { coverage: null, hasCoverage: false };
    }
  }
}

// Main execution for github-script
export function extractCoverage(workingDirectory: string = '.', coverageFile: string = 'coverage.out'): CoverageResult {
  const extractor = new CoverageExtractor({ workingDirectory, coverageFile });
  return extractor.extractCoverage();
}