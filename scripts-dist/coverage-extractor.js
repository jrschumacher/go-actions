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
exports.CoverageExtractor = void 0;
exports.extractCoverage = extractCoverage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
/**
 * Validates that a coverage file name is safe (no path traversal or shell injection)
 */
function validateCoverageFileName(fileName) {
    // Only allow alphanumeric, dots, hyphens, and underscores
    const safePattern = /^[\w.-]+$/;
    // Prevent path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        return false;
    }
    return safePattern.test(fileName);
}
class CoverageExtractor {
    constructor(options) {
        this.workingDir = options.workingDirectory;
        const coverageFile = options.coverageFile || 'coverage.out';
        // Validate coverage file name to prevent injection
        if (!validateCoverageFileName(coverageFile)) {
            throw new Error(`Invalid coverage file name: ${coverageFile}. Only alphanumeric characters, dots, hyphens, and underscores are allowed.`);
        }
        this.coverageFile = coverageFile;
    }
    extractCoverage() {
        const coveragePath = path.join(this.workingDir, this.coverageFile);
        if (!fs.existsSync(coveragePath)) {
            console.log('No coverage file found');
            return { coverage: null, hasCoverage: false };
        }
        try {
            // Use spawnSync with array arguments to prevent command injection
            const result = (0, child_process_1.spawnSync)('go', ['tool', 'cover', `-func=${this.coverageFile}`], {
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
            console.log(`Test coverage: ${coverage}`);
            return { coverage, hasCoverage: true };
        }
        catch (error) {
            console.log('Failed to extract coverage information');
            console.log(`Error: ${error}`);
            return { coverage: null, hasCoverage: false };
        }
    }
    /**
     * Extracts the coverage percentage from go tool cover output
     * Replaces shell piping: grep total | awk '{print $3}'
     */
    extractCoverageFromOutput(output) {
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
}
exports.CoverageExtractor = CoverageExtractor;
// Main execution for github-script
function extractCoverage(workingDirectory = '.', coverageFile = 'coverage.out') {
    const extractor = new CoverageExtractor({ workingDirectory, coverageFile });
    return extractor.extractCoverage();
}
//# sourceMappingURL=coverage-extractor.js.map