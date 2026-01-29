import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv, { ValidateFunction } from 'ajv';
import configSchema from './config-schema.json';

/**
 * Go version configuration
 */
export interface GoConfig {
  /** Explicit Go version (e.g., '1.21', overrides version-file) */
  version?: string;
  /** Path to file containing Go version (default: go.mod) */
  'version-file'?: string;
}

/**
 * Test coverage configuration
 */
export interface CoverageConfig {
  /** Enable coverage reporting */
  enabled?: boolean;
  /** Minimum coverage percentage (0-100) */
  threshold?: number;
}

/**
 * Test configuration
 */
export interface TestConfig {
  /** Enable test job */
  enabled?: boolean;
  /** Arguments passed to 'go test' */
  args?: string;
  /** Coverage configuration */
  coverage?: CoverageConfig;
}

/**
 * Lint configuration
 */
export interface LintConfig {
  /** Enable lint job */
  enabled?: boolean;
  /** golangci-lint version (e.g., 'v2.0.2') */
  version?: string;
  /** Additional arguments passed to golangci-lint */
  args?: string;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  /** Enable benchmark job */
  enabled?: boolean;
  /** Arguments passed to 'go test' for benchmarks */
  args?: string;
  /** Number of benchmark iterations */
  count?: number;
}

/**
 * Security scanning configuration
 */
export interface SecurityConfig {
  /** Enable security scanning job */
  enabled?: boolean;
  /** govulncheck version (e.g., 'latest') */
  version?: string;
  /** Additional arguments passed to govulncheck */
  args?: string;
  /** Severity level to fail build on */
  'fail-on'?: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

/**
 * CI workflow configuration
 */
export interface CIConfig {
  /** Go version configuration */
  go?: GoConfig;
  /** Test configuration */
  test?: TestConfig;
  /** Lint configuration */
  lint?: LintConfig;
  /** Benchmark configuration */
  benchmark?: BenchmarkConfig;
  /** Security scanning configuration */
  security?: SecurityConfig;
}

/**
 * Release Please specific configuration
 */
export interface ReleasePleaseConfig {
  /** Release Please release type */
  'release-type'?: string;
  /** Additional files to update version in */
  'extra-files'?: string[];
}

/**
 * GoReleaser specific configuration
 */
export interface GoReleaserConfig {
  /** Additional arguments passed to goreleaser */
  args?: string;
}

/**
 * Release workflow configuration
 */
export interface ReleaseConfig {
  /** Release strategy to use */
  strategy?: 'release-please' | 'goreleaser' | 'manual';
  /** Release Please specific configuration */
  'release-please'?: ReleasePleaseConfig;
  /** GoReleaser specific configuration */
  goreleaser?: GoReleaserConfig;
}

/**
 * Git hooks configuration
 */
export interface HooksConfig {
  /** Commands to run on pre-commit */
  'pre-commit'?: string[];
  /** Commands to run on pre-push */
  'pre-push'?: string[];
}

/**
 * AI agent features configuration
 */
export interface AgentConfig {
  /** Enable AI agent features */
  enabled?: boolean;
  /** Automatically fix issues when possible */
  'auto-fix'?: boolean;
}

/**
 * Local development and CLI configuration
 */
export interface LocalConfig {
  /** Git hooks configuration */
  hooks?: HooksConfig;
  /** AI agent features configuration */
  agent?: AgentConfig;
}

/**
 * Output formatting configuration
 */
export interface OutputConfig {
  /** Output format for reports */
  format?: 'auto' | 'json' | 'text' | 'markdown';
  /** Verbosity level for output */
  verbosity?: 'quiet' | 'normal' | 'verbose' | 'debug';
}

/**
 * Complete Go Actions configuration
 */
export interface GoActionsConfig {
  /** Configuration file format version */
  version: number;
  /** CI workflow configuration */
  ci?: CIConfig;
  /** Release workflow configuration */
  release?: ReleaseConfig;
  /** Local development and CLI configuration */
  local?: LocalConfig;
  /** Output formatting configuration */
  output?: OutputConfig;
}

/**
 * Input overrides from workflow
 */
export interface InputOverrides {
  /** Go version override */
  goVersion?: string;
  /** Go version file override */
  goVersionFile?: string;
  /** Test arguments override */
  testArgs?: string;
  /** Lint version override */
  lintVersion?: string;
  /** Lint arguments override */
  lintArgs?: string;
  /** Benchmark arguments override */
  benchmarkArgs?: string;
  /** Benchmark count override */
  benchmarkCount?: number;
  /** Security version override */
  securityVersion?: string;
  /** Security arguments override */
  securityArgs?: string;
  /** Security fail-on override */
  securityFailOn?: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: GoActionsConfig = {
  version: 1,
  ci: {
    go: {
      version: '',
      'version-file': 'go.mod',
    },
    test: {
      enabled: true,
      args: '-v -race -coverprofile=coverage.out ./...',
      coverage: {
        enabled: true,
        threshold: 0,
      },
    },
    lint: {
      enabled: true,
      version: 'v2.0.2',
      args: '',
    },
    benchmark: {
      enabled: false,
      args: '-bench=. -benchmem',
      count: 5,
    },
    security: {
      enabled: true,
      version: 'latest',
      args: '',
      'fail-on': 'high',
    },
  },
  release: {
    strategy: 'release-please',
  },
  output: {
    format: 'auto',
    verbosity: 'normal',
  },
};

/**
 * Config file names in priority order
 */
const CONFIG_FILE_NAMES = [
  '.go-actions.yaml',
  '.go-actions.yml',
  'go-actions.yaml',
];

/**
 * Config loader errors
 */
export class ConfigLoaderError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly validationErrors?: string[]
  ) {
    super(message);
    this.name = 'ConfigLoaderError';
  }
}

/**
 * Configuration loader for .go-actions.yaml files
 */
export class ConfigLoader {
  private validator: ValidateFunction;

  constructor() {
    const ajv = new Ajv({ allErrors: true, verbose: true });
    this.validator = ajv.compile(configSchema);
  }

  /**
   * Find config file in the working directory
   * @param workingDir Working directory to search
   * @returns Path to config file or undefined if not found
   */
  private findConfigFile(workingDir: string): string | undefined {
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = path.join(workingDir, fileName);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    return undefined;
  }

  /**
   * Parse YAML config file
   * @param filePath Path to config file
   * @returns Parsed config object
   */
  private parseConfigFile(filePath: string): unknown {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return yaml.load(fileContent);
    } catch (error) {
      if (error instanceof Error) {
        throw new ConfigLoaderError(
          `Failed to parse config file: ${error.message}`,
          filePath
        );
      }
      throw new ConfigLoaderError('Failed to parse config file', filePath);
    }
  }

  /**
   * Validate config against JSON schema
   * @param config Config object to validate
   * @param filePath Path to config file (for error reporting)
   */
  private validateConfig(config: unknown, filePath: string): void {
    const valid = this.validator(config);
    if (!valid) {
      const errors = this.validator.errors?.map(
        (err) => `${err.instancePath} ${err.message}`
      ) || ['Unknown validation error'];

      throw new ConfigLoaderError(
        `Config validation failed: ${errors.join(', ')}`,
        filePath,
        errors
      );
    }

    // Emit warnings for unknown fields (for forward compatibility)
    if (typeof config === 'object' && config !== null) {
      this.checkUnknownFields(config as Record<string, unknown>, filePath);
    }
  }

  /**
   * Check for unknown fields and emit warnings
   * @param config Config object
   * @param filePath Path to config file
   */
  private checkUnknownFields(config: Record<string, unknown>, filePath: string): void {
    const knownTopLevelFields = ['version', 'ci', 'release', 'local', 'output'];
    const unknownFields = Object.keys(config).filter(
      (key) => !knownTopLevelFields.includes(key)
    );

    if (unknownFields.length > 0) {
      console.warn(
        `Warning: Unknown fields in ${filePath}: ${unknownFields.join(', ')}. ` +
        'These will be ignored for forward compatibility.'
      );
    }
  }

  /**
   * Deep merge two objects
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        sourceValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue) &&
        targetValue !== null
      ) {
        result[key] = this.deepMerge(targetValue as Record<string, any>, sourceValue as Record<string, any>) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }

    return result;
  }

  /**
   * Apply input overrides to config
   * @param config Base config
   * @param overrides Input overrides from workflow
   * @returns Config with overrides applied
   */
  private applyOverrides(
    config: GoActionsConfig,
    overrides: InputOverrides
  ): GoActionsConfig {
    const result = { ...config };

    if (!result.ci) {
      result.ci = {};
    }

    // Apply Go version overrides
    if (overrides.goVersion !== undefined || overrides.goVersionFile !== undefined) {
      if (!result.ci.go) {
        result.ci.go = {};
      }
      if (overrides.goVersion !== undefined) {
        result.ci.go.version = overrides.goVersion;
      }
      if (overrides.goVersionFile !== undefined) {
        result.ci.go['version-file'] = overrides.goVersionFile;
      }
    }

    // Apply test overrides
    if (overrides.testArgs !== undefined) {
      if (!result.ci.test) {
        result.ci.test = {};
      }
      result.ci.test.args = overrides.testArgs;
    }

    // Apply lint overrides
    if (overrides.lintVersion !== undefined || overrides.lintArgs !== undefined) {
      if (!result.ci.lint) {
        result.ci.lint = {};
      }
      if (overrides.lintVersion !== undefined) {
        result.ci.lint.version = overrides.lintVersion;
      }
      if (overrides.lintArgs !== undefined) {
        result.ci.lint.args = overrides.lintArgs;
      }
    }

    // Apply benchmark overrides
    if (overrides.benchmarkArgs !== undefined || overrides.benchmarkCount !== undefined) {
      if (!result.ci.benchmark) {
        result.ci.benchmark = {};
      }
      if (overrides.benchmarkArgs !== undefined) {
        result.ci.benchmark.args = overrides.benchmarkArgs;
      }
      if (overrides.benchmarkCount !== undefined) {
        result.ci.benchmark.count = overrides.benchmarkCount;
      }
    }

    // Apply security overrides
    if (
      overrides.securityVersion !== undefined ||
      overrides.securityArgs !== undefined ||
      overrides.securityFailOn !== undefined
    ) {
      if (!result.ci.security) {
        result.ci.security = {};
      }
      if (overrides.securityVersion !== undefined) {
        result.ci.security.version = overrides.securityVersion;
      }
      if (overrides.securityArgs !== undefined) {
        result.ci.security.args = overrides.securityArgs;
      }
      if (overrides.securityFailOn !== undefined) {
        result.ci.security['fail-on'] = overrides.securityFailOn;
      }
    }

    return result;
  }

  /**
   * Deep clone an object
   * @param obj Object to clone
   * @returns Deep clone of the object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Load and merge configuration
   * @param workingDir Working directory to search for config
   * @param overrides Input overrides from workflow
   * @returns Merged configuration
   */
  public loadConfig(
    workingDir: string,
    overrides: InputOverrides = {}
  ): GoActionsConfig {
    // Start with default config (deep clone to avoid mutation)
    let config = this.deepClone(DEFAULT_CONFIG);

    // Find and load config file if it exists
    const configFilePath = this.findConfigFile(workingDir);
    if (configFilePath) {
      const fileConfig = this.parseConfigFile(configFilePath);
      this.validateConfig(fileConfig, configFilePath);
      config = this.deepMerge(config, fileConfig as Partial<GoActionsConfig>);
    }

    // Apply input overrides (highest priority)
    config = this.applyOverrides(config, overrides);

    return config;
  }

  /**
   * Check if config file exists in working directory
   * @param workingDir Working directory to check
   * @returns True if config file exists
   */
  public hasConfigFile(workingDir: string): boolean {
    return this.findConfigFile(workingDir) !== undefined;
  }

  /**
   * Get path to config file if it exists
   * @param workingDir Working directory to check
   * @returns Path to config file or undefined
   */
  public getConfigFilePath(workingDir: string): string | undefined {
    return this.findConfigFile(workingDir);
  }
}

/**
 * Convenience function to load configuration
 * @param workingDir Working directory to search for config
 * @param overrides Input overrides from workflow
 * @returns Merged configuration
 */
export function loadConfig(
  workingDir: string,
  overrides: InputOverrides = {}
): GoActionsConfig {
  const loader = new ConfigLoader();
  return loader.loadConfig(workingDir, overrides);
}
