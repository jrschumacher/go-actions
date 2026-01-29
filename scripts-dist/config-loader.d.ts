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
 * Config loader errors
 */
export declare class ConfigLoaderError extends Error {
    readonly filePath?: string | undefined;
    readonly validationErrors?: string[] | undefined;
    constructor(message: string, filePath?: string | undefined, validationErrors?: string[] | undefined);
}
/**
 * Configuration loader for .go-actions.yaml files
 */
export declare class ConfigLoader {
    private validator;
    constructor();
    /**
     * Find config file in the working directory
     * @param workingDir Working directory to search
     * @returns Path to config file or undefined if not found
     */
    private findConfigFile;
    /**
     * Parse YAML config file
     * @param filePath Path to config file
     * @returns Parsed config object
     */
    private parseConfigFile;
    /**
     * Validate config against JSON schema
     * @param config Config object to validate
     * @param filePath Path to config file (for error reporting)
     */
    private validateConfig;
    /**
     * Check for unknown fields and emit warnings
     * @param config Config object
     * @param filePath Path to config file
     */
    private checkUnknownFields;
    /**
     * Deep merge two objects
     * @param target Target object
     * @param source Source object
     * @returns Merged object
     */
    private deepMerge;
    /**
     * Apply input overrides to config
     * @param config Base config
     * @param overrides Input overrides from workflow
     * @returns Config with overrides applied
     */
    private applyOverrides;
    /**
     * Deep clone an object
     * @param obj Object to clone
     * @returns Deep clone of the object
     */
    private deepClone;
    /**
     * Load and merge configuration
     * @param workingDir Working directory to search for config
     * @param overrides Input overrides from workflow
     * @returns Merged configuration
     */
    loadConfig(workingDir: string, overrides?: InputOverrides): GoActionsConfig;
    /**
     * Check if config file exists in working directory
     * @param workingDir Working directory to check
     * @returns True if config file exists
     */
    hasConfigFile(workingDir: string): boolean;
    /**
     * Get path to config file if it exists
     * @param workingDir Working directory to check
     * @returns Path to config file or undefined
     */
    getConfigFilePath(workingDir: string): string | undefined;
}
/**
 * Convenience function to load configuration
 * @param workingDir Working directory to search for config
 * @param overrides Input overrides from workflow
 * @returns Merged configuration
 */
export declare function loadConfig(workingDir: string, overrides?: InputOverrides): GoActionsConfig;
