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
const coverage_extractor_1 = require("./coverage-extractor");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
// Mock fs and spawnSync
jest.mock('fs');
jest.mock('child_process');
const mockFs = fs;
const mockSpawnSync = child_process_1.spawnSync;
describe('CoverageExtractor', () => {
    let extractor;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        extractor = new coverage_extractor_1.CoverageExtractor({ workingDirectory: testWorkingDir });
    });
    describe('constructor validation', () => {
        it('should accept valid coverage file names', () => {
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: 'coverage.out'
            })).not.toThrow();
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: 'my-coverage_file.out'
            })).not.toThrow();
        });
        it('should reject coverage file names with path traversal', () => {
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: '../../../etc/passwd'
            })).toThrow('Invalid coverage file name');
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: 'path/to/coverage.out'
            })).toThrow('Invalid coverage file name');
        });
        it('should reject coverage file names with shell injection characters', () => {
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: 'coverage.out; rm -rf /'
            })).toThrow('Invalid coverage file name');
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: 'coverage.out && malicious'
            })).toThrow('Invalid coverage file name');
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: '$(whoami).out'
            })).toThrow('Invalid coverage file name');
            expect(() => new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: '`whoami`.out'
            })).toThrow('Invalid coverage file name');
        });
    });
    describe('extractCoverage', () => {
        it('should return no coverage when coverage file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: null,
                hasCoverage: false
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testWorkingDir, 'coverage.out'));
        });
        it('should extract coverage when coverage file exists', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'github.com/user/repo/main.go:10:\tfunction1\t\t80.0%\ngithub.com/user/repo/main.go:20:\tfunction2\t\t90.0%\ntotal:\t\t\t(statements)\t85.7%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: '85.7%',
                hasCoverage: true,
                percentage: 85.7,
                meetsThreshold: true
            });
            expect(mockSpawnSync).toHaveBeenCalledWith('go', ['tool', 'cover', '-func=coverage.out'], {
                cwd: testWorkingDir,
                encoding: 'utf8'
            });
        });
        it('should handle spawnSync errors gracefully', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: '',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: new Error('Command failed')
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: null,
                hasCoverage: false
            });
        });
        it('should handle non-zero exit status', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: '',
                stderr: 'go tool cover: cannot find main module',
                status: 1,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: null,
                hasCoverage: false
            });
        });
        it('should use custom coverage file name', () => {
            const customExtractor = new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                coverageFile: 'custom-coverage.out'
            });
            mockFs.existsSync.mockReturnValue(false);
            customExtractor.extractCoverage();
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testWorkingDir, 'custom-coverage.out'));
        });
        it('should handle empty output from go tool cover', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: '   \n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: '',
                hasCoverage: true,
                percentage: undefined,
                meetsThreshold: true
            });
        });
        it('should handle output without total line', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'some random output\nwithout total',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: 'some random output\nwithout total',
                hasCoverage: true,
                percentage: undefined,
                meetsThreshold: true
            });
        });
        it('should handle different coverage formats', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t92.3%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: '92.3%',
                hasCoverage: true,
                percentage: 92.3,
                meetsThreshold: true
            });
        });
        it('should extract percentage from complex output', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: `github.com/user/repo/pkg/util.go:15:	Helper		100.0%
github.com/user/repo/pkg/util.go:25:	Process		75.0%
github.com/user/repo/main.go:10:	main		50.0%
total:					(statements)	75.0%
`,
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: '75.0%',
                hasCoverage: true,
                percentage: 75.0,
                meetsThreshold: true
            });
        });
    });
    describe('extractCoverage function export', () => {
        it('should work with default parameters', () => {
            const { extractCoverage } = require('./coverage-extractor');
            mockFs.existsSync.mockReturnValue(false);
            const result = extractCoverage();
            expect(result.hasCoverage).toBe(false);
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('.', 'coverage.out'));
        });
        it('should work with custom parameters', () => {
            const { extractCoverage } = require('./coverage-extractor');
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t75.0%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractCoverage('/custom/dir', 'custom.out');
            expect(result).toEqual({
                coverage: '75.0%',
                hasCoverage: true,
                percentage: 75.0,
                meetsThreshold: true
            });
        });
        it('should throw on invalid coverage file name in function export', () => {
            const { extractCoverage } = require('./coverage-extractor');
            expect(() => extractCoverage('.', '../malicious.out')).toThrow('Invalid coverage file name');
        });
    });
    describe('coverage threshold', () => {
        it('should check threshold when configured', () => {
            const extractorWithThreshold = new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                threshold: 80
            });
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t75.0%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractorWithThreshold.extractCoverage();
            expect(result).toEqual({
                coverage: '75.0%',
                hasCoverage: true,
                percentage: 75.0,
                meetsThreshold: false
            });
        });
        it('should pass threshold when coverage meets requirement', () => {
            const extractorWithThreshold = new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                threshold: 80
            });
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t85.0%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractorWithThreshold.extractCoverage();
            expect(result).toEqual({
                coverage: '85.0%',
                hasCoverage: true,
                percentage: 85.0,
                meetsThreshold: true
            });
        });
        it('should pass threshold when coverage exactly meets requirement', () => {
            const extractorWithThreshold = new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                threshold: 75
            });
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t75.0%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractorWithThreshold.extractCoverage();
            expect(result).toEqual({
                coverage: '75.0%',
                hasCoverage: true,
                percentage: 75.0,
                meetsThreshold: true
            });
        });
        it('should not check threshold when set to 0', () => {
            const extractorNoThreshold = new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                threshold: 0
            });
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t10.0%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractorNoThreshold.extractCoverage();
            expect(result).toEqual({
                coverage: '10.0%',
                hasCoverage: true,
                percentage: 10.0,
                meetsThreshold: true
            });
        });
        it('should handle threshold with unparseable coverage', () => {
            const extractorWithThreshold = new coverage_extractor_1.CoverageExtractor({
                workingDirectory: testWorkingDir,
                threshold: 80
            });
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'invalid output\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractorWithThreshold.extractCoverage();
            expect(result).toEqual({
                coverage: 'invalid output',
                hasCoverage: true,
                percentage: undefined,
                meetsThreshold: true
            });
        });
        it('should work with threshold parameter in function export', () => {
            const { extractCoverage } = require('./coverage-extractor');
            mockFs.existsSync.mockReturnValue(true);
            mockSpawnSync.mockReturnValue({
                stdout: 'total:\t\t\t(statements)\t65.0%\n',
                stderr: '',
                status: 0,
                signal: null,
                pid: 12345,
                output: ['', '', ''],
                error: undefined
            });
            const result = extractCoverage('.', 'coverage.out', 70);
            expect(result).toEqual({
                coverage: '65.0%',
                hasCoverage: true,
                percentage: 65.0,
                meetsThreshold: false
            });
        });
    });
});
//# sourceMappingURL=coverage-extractor.test.js.map