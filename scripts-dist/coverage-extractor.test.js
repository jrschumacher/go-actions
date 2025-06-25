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
// Mock fs and execSync
jest.mock('fs');
jest.mock('child_process');
const mockFs = fs;
const mockExecSync = child_process_1.execSync;
describe('CoverageExtractor', () => {
    let extractor;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        extractor = new coverage_extractor_1.CoverageExtractor({ workingDirectory: testWorkingDir });
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
            mockExecSync.mockReturnValue('85.7%\n');
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: '85.7%',
                hasCoverage: true
            });
            expect(mockExecSync).toHaveBeenCalledWith('go tool cover -func=coverage.out | grep total | awk \'{print $3}\'', {
                cwd: testWorkingDir,
                encoding: 'utf8'
            });
        });
        it('should handle execSync errors gracefully', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockExecSync.mockImplementation(() => {
                throw new Error('Command failed');
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
            mockExecSync.mockReturnValue('   \n');
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: '',
                hasCoverage: true
            });
        });
        it('should handle different coverage formats', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockExecSync.mockReturnValue('total:\t\t\t(statements)\t92.3%\n');
            const result = extractor.extractCoverage();
            expect(result).toEqual({
                coverage: 'total:\t\t\t(statements)\t92.3%',
                hasCoverage: true
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
            mockExecSync.mockReturnValue('75.0%\n');
            const result = extractCoverage('/custom/dir', 'custom.out');
            expect(result).toEqual({
                coverage: '75.0%',
                hasCoverage: true
            });
        });
    });
});
//# sourceMappingURL=coverage-extractor.test.js.map