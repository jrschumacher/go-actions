"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = exports.ConfigLoaderError = void 0;
exports.loadConfig = loadConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const ajv_1 = __importDefault(require("ajv"));
const config_schema_json_1 = __importDefault(require("./config-schema.json"));
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
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
class ConfigLoaderError extends Error {
    constructor(message, filePath, validationErrors) {
        super(message);
        this.filePath = filePath;
        this.validationErrors = validationErrors;
        this.name = 'ConfigLoaderError';
    }
}
exports.ConfigLoaderError = ConfigLoaderError;
/**
 * Configuration loader for .go-actions.yaml files
 */
class ConfigLoader {
    constructor() {
        const ajv = new ajv_1.default({ allErrors: true, verbose: true });
        this.validator = ajv.compile(config_schema_json_1.default);
    }
    /**
     * Find config file in the working directory
     * @param workingDir Working directory to search
     * @returns Path to config file or undefined if not found
     */
    findConfigFile(workingDir) {
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
    parseConfigFile(filePath) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return yaml.load(fileContent);
        }
        catch (error) {
            if (error instanceof Error) {
                throw new ConfigLoaderError(`Failed to parse config file: ${error.message}`, filePath);
            }
            throw new ConfigLoaderError('Failed to parse config file', filePath);
        }
    }
    /**
     * Validate config against JSON schema
     * @param config Config object to validate
     * @param filePath Path to config file (for error reporting)
     */
    validateConfig(config, filePath) {
        const valid = this.validator(config);
        if (!valid) {
            const errors = this.validator.errors?.map((err) => `${err.instancePath} ${err.message}`) || ['Unknown validation error'];
            throw new ConfigLoaderError(`Config validation failed: ${errors.join(', ')}`, filePath, errors);
        }
        // Emit warnings for unknown fields (for forward compatibility)
        if (typeof config === 'object' && config !== null) {
            this.checkUnknownFields(config, filePath);
        }
    }
    /**
     * Check for unknown fields and emit warnings
     * @param config Config object
     * @param filePath Path to config file
     */
    checkUnknownFields(config, filePath) {
        const knownTopLevelFields = ['version', 'ci', 'release', 'local', 'output'];
        const unknownFields = Object.keys(config).filter((key) => !knownTopLevelFields.includes(key));
        if (unknownFields.length > 0) {
            console.warn(`Warning: Unknown fields in ${filePath}: ${unknownFields.join(', ')}. ` +
                'These will be ignored for forward compatibility.');
        }
    }
    /**
     * Deep merge two objects
     * @param target Target object
     * @param source Source object
     * @returns Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = result[key];
            if (sourceValue !== undefined &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                sourceValue !== null &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue) &&
                targetValue !== null) {
                result[key] = this.deepMerge(targetValue, sourceValue);
            }
            else if (sourceValue !== undefined) {
                result[key] = sourceValue;
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
    applyOverrides(config, overrides) {
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
        if (overrides.securityVersion !== undefined ||
            overrides.securityArgs !== undefined ||
            overrides.securityFailOn !== undefined) {
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
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    /**
     * Load and merge configuration
     * @param workingDir Working directory to search for config
     * @param overrides Input overrides from workflow
     * @returns Merged configuration
     */
    loadConfig(workingDir, overrides = {}) {
        // Start with default config (deep clone to avoid mutation)
        let config = this.deepClone(DEFAULT_CONFIG);
        // Find and load config file if it exists
        const configFilePath = this.findConfigFile(workingDir);
        if (configFilePath) {
            const fileConfig = this.parseConfigFile(configFilePath);
            this.validateConfig(fileConfig, configFilePath);
            config = this.deepMerge(config, fileConfig);
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
    hasConfigFile(workingDir) {
        return this.findConfigFile(workingDir) !== undefined;
    }
    /**
     * Get path to config file if it exists
     * @param workingDir Working directory to check
     * @returns Path to config file or undefined
     */
    getConfigFilePath(workingDir) {
        return this.findConfigFile(workingDir);
    }
}
exports.ConfigLoader = ConfigLoader;
/**
 * Convenience function to load configuration
 * @param workingDir Working directory to search for config
 * @param overrides Input overrides from workflow
 * @returns Merged configuration
 */
function loadConfig(workingDir, overrides = {}) {
    const loader = new ConfigLoader();
    return loader.loadConfig(workingDir, overrides);
}
//# sourceMappingURL=config-loader.js.map