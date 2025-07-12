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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleasePleaseValidator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ReleasePleaseValidator {
    constructor(workingDir = '.') {
        this.workingDir = workingDir;
    }
    fileExists(filePath) {
        return fs.existsSync(path.join(this.workingDir, filePath));
    }
    validate() {
        const errors = [];
        // Validate config file (release-please-config.json - no dot prefix)
        this.validateConfigFile(errors);
        // Validate manifest file (.release-please-manifest.json - with dot prefix)  
        this.validateManifestFile(errors);
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateConfigFile(errors) {
        const correctFilename = 'release-please-config.json';
        const incorrectFilename = '.release-please-config.json';
        if (!this.fileExists(correctFilename)) {
            // Check for common mistake (with dot prefix)
            if (this.fileExists(incorrectFilename)) {
                errors.push({
                    type: 'filename_error',
                    message: `Found ${incorrectFilename} but Release Please expects ${correctFilename} (no dot prefix)`,
                    file: correctFilename,
                    severity: 'error'
                });
            }
            else {
                errors.push({
                    type: 'missing_file',
                    message: `${correctFilename} (required for release action)`,
                    file: correctFilename,
                    severity: 'error'
                });
            }
            return;
        }
        // Validate configuration format
        try {
            const configPath = path.join(this.workingDir, correctFilename);
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            // Check for v16+ format (release-type at root level)
            if (!config['release-type']) {
                if (config.packages && config.packages['.'] && config.packages['.']['release-type']) {
                    errors.push({
                        type: 'format_error',
                        message: 'Release Please configuration uses legacy format. Move release-type to root level for v16+ compatibility',
                        file: correctFilename,
                        severity: 'warning'
                    });
                }
                else {
                    errors.push({
                        type: 'format_error',
                        message: 'Release Please config should use "release-type": "go" for Go projects',
                        file: correctFilename,
                        severity: 'error'
                    });
                }
            }
            // Check for package-name at root level
            if (!config['package-name']) {
                if (config.packages && config.packages['.'] && config.packages['.']['package-name']) {
                    errors.push({
                        type: 'format_error',
                        message: 'Release Please configuration uses legacy format. Move package-name to root level for v16+ compatibility',
                        file: correctFilename,
                        severity: 'warning'
                    });
                }
                else {
                    errors.push({
                        type: 'format_error',
                        message: 'Release Please config missing "package-name" field',
                        file: correctFilename,
                        severity: 'error'
                    });
                }
            }
        }
        catch (error) {
            errors.push({
                type: 'invalid_json',
                message: `Invalid JSON in ${correctFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                file: correctFilename,
                severity: 'error'
            });
        }
    }
    validateManifestFile(errors) {
        const correctFilename = '.release-please-manifest.json';
        const incorrectFilename = 'release-please-manifest.json';
        if (!this.fileExists(correctFilename)) {
            // Check for common mistake (without dot prefix)
            if (this.fileExists(incorrectFilename)) {
                errors.push({
                    type: 'filename_error',
                    message: `Found ${incorrectFilename} but Release Please expects ${correctFilename} (with dot prefix)`,
                    file: correctFilename,
                    severity: 'error'
                });
            }
            else {
                errors.push({
                    type: 'missing_file',
                    message: `${correctFilename} (required for release action)`,
                    file: correctFilename,
                    severity: 'error'
                });
            }
        }
    }
    generateConfigTemplate() {
        return JSON.stringify({
            'release-type': 'go',
            'package-name': 'your-module-name',
            packages: {
                '.': {}
            }
        }, null, 2);
    }
    generateManifestTemplate() {
        return JSON.stringify({ '.': '0.1.0' }, null, 2);
    }
}
exports.ReleasePleaseValidator = ReleasePleaseValidator;
//# sourceMappingURL=release-please-validator.js.map