#!/usr/bin/env node

/**
 * Build validation script
 * Validates the production build for common issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '..', 'dist');
const REQUIRED_FILES = [
  'index.html',
  'assets',
];

const MAX_BUNDLE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CHUNK_SIZE = 500 * 1024; // 500KB

class BuildValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addError(message) {
    this.errors.push(message);
    this.log(message, 'error');
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log(message, 'warning');
  }

  validateDistExists() {
    this.log('Checking if dist directory exists...');
    
    if (!fs.existsSync(DIST_DIR)) {
      this.addError('dist directory does not exist. Run "npm run build" first.');
      return false;
    }
    
    this.log('dist directory found', 'success');
    return true;
  }

  validateRequiredFiles() {
    this.log('Checking required files...');
    
    for (const file of REQUIRED_FILES) {
      const filePath = path.join(DIST_DIR, file);
      if (!fs.existsSync(filePath)) {
        this.addError(`Required file/directory missing: ${file}`);
      } else {
        this.log(`Found: ${file}`, 'success');
      }
    }
  }

  validateIndexHtml() {
    this.log('Validating index.html...');
    
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
      this.addError('index.html not found');
      return;
    }

    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for essential meta tags.
    //
    // Matched case-insensitively: HTML attribute values here are not
    // case-sensitive, and `<meta charset="UTF-8">` (what Vite and the HTML5
    // spec examples use) is correct. A case-sensitive check reported it as
    // "missing or malformed" forever.
    const requiredMeta = [
      '<meta charset="utf-8"',
      '<meta name="viewport"',
      '<title>',
    ];

    const lowerContent = content.toLowerCase();
    for (const meta of requiredMeta) {
      if (!lowerContent.includes(meta.toLowerCase())) {
        this.addWarning(`Missing or malformed meta tag: ${meta}`);
      }
    }

    // Check for script and CSS links
    if (!content.includes('<script') && !content.includes('type="module"')) {
      this.addError('No JavaScript modules found in index.html');
    }

    if (!content.includes('<link') && !content.includes('stylesheet')) {
      this.addWarning('No CSS stylesheets found in index.html');
    }

    this.log('index.html validation complete', 'success');
  }

  validateAssets() {
    this.log('Validating assets...');
    
    const assetsDir = path.join(DIST_DIR, 'assets');
    if (!fs.existsSync(assetsDir)) {
      this.addError('assets directory not found');
      return;
    }

    const files = fs.readdirSync(assetsDir);
    let totalSize = 0;
    let jsFiles = 0;
    let cssFiles = 0;

    for (const file of files) {
      // Source maps are never served to users - counting them made a dev
      // build report ~4 MB and trip the bundle-size warning.
      if (file.endsWith('.map')) continue;

      const filePath = path.join(assetsDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      if (file.endsWith('.js')) {
        jsFiles++;
        if (stats.size > MAX_CHUNK_SIZE) {
          this.addWarning(`Large JavaScript chunk: ${file} (${this.formatBytes(stats.size)})`);
        }
      } else if (file.endsWith('.css')) {
        cssFiles++;
      }
    }

    if (totalSize > MAX_BUNDLE_SIZE) {
      this.addWarning(`Large bundle size: ${this.formatBytes(totalSize)}`);
    }

    this.log(`Found ${jsFiles} JavaScript files, ${cssFiles} CSS files`, 'success');
    this.log(`Total bundle size: ${this.formatBytes(totalSize)}`, 'success');
  }

  validateSourceMaps() {
    this.log('Checking source maps...');
    
    const assetsDir = path.join(DIST_DIR, 'assets');
    if (!fs.existsSync(assetsDir)) return;

    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const mapFiles = files.filter(f => f.endsWith('.js.map'));

    // `vite build` runs in production mode unless told otherwise, and this
    // script only ever inspects a `vite build` output. Treating an unset
    // NODE_ENV as "development" therefore demanded source maps from every
    // ordinary production build and warned when it correctly withheld them.
    // Opt in to a dev build explicitly instead.
    const isDevBuild = process.env.NODE_ENV === 'development';

    if (!isDevBuild && mapFiles.length > 0) {
      this.addWarning(`Source maps found in production build (${mapFiles.length} files)`);
    }

    if (isDevBuild && mapFiles.length === 0) {
      this.addWarning('No source maps found in development build');
    }
  }

  validateSecurity() {
    this.log('Checking security headers...');
    
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) return;

    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for CSP
    if (!content.includes('Content-Security-Policy')) {
      this.addWarning('No Content-Security-Policy found');
    }

    // Check for other security headers
    const securityHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy'
    ];

    for (const header of securityHeaders) {
      if (!content.includes(header)) {
        this.addWarning(`Security header not found: ${header}`);
      }
    }
  }

  validateAccessibility() {
    this.log('Checking accessibility...');
    
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) return;

    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for lang attribute
    if (!content.includes('lang=')) {
      this.addWarning('No lang attribute found on html element');
    }

    // Check for skip links
    if (!content.includes('skip')) {
      this.addWarning('No skip links found for accessibility');
    }
  }

  validatePerformance() {
    this.log('Checking performance optimizations...');
    
    const assetsDir = path.join(DIST_DIR, 'assets');
    if (!fs.existsSync(assetsDir)) return;

    const files = fs.readdirSync(assetsDir);
    
    // Check for code splitting
    const jsFiles = files.filter(f => f.endsWith('.js'));
    if (jsFiles.length < 2) {
      this.addWarning('No code splitting detected - consider splitting large bundles');
    }

    // Check for asset optimization
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));
    if (imageFiles.length === 0) {
      this.log('No images found in assets', 'info');
    }

    // Check for font optimization
    const fontFiles = files.filter(f => /\.(woff|woff2|ttf|eot)$/i.test(f));
    if (fontFiles.length > 0) {
      this.log(`Found ${fontFiles.length} font files`, 'success');
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateReport() {
    this.log('\n📊 Build Validation Report');
    this.log('='.repeat(50));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('🎉 Build validation passed with no issues!', 'success');
    } else {
      if (this.errors.length > 0) {
        this.log(`\n❌ Errors (${this.errors.length}):`);
        this.errors.forEach((error, i) => {
          this.log(`  ${i + 1}. ${error}`);
        });
      }

      if (this.warnings.length > 0) {
        this.log(`\n⚠️  Warnings (${this.warnings.length}):`);
        this.warnings.forEach((warning, i) => {
          this.log(`  ${i + 1}. ${warning}`);
        });
      }
    }

    this.log('\n📋 Summary:');
    this.log(`  Errors: ${this.errors.length}`);
    this.log(`  Warnings: ${this.warnings.length}`);
    
    return this.errors.length === 0;
  }

  async run() {
    this.log('🚀 Starting build validation...\n');

    if (!this.validateDistExists()) {
      return this.generateReport();
    }

    this.validateRequiredFiles();
    this.validateIndexHtml();
    this.validateAssets();
    this.validateSourceMaps();
    this.validateSecurity();
    this.validateAccessibility();
    this.validatePerformance();

    return this.generateReport();
  }
}

// Run validation
const validator = new BuildValidator();
validator.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Build validation failed:', error);
  process.exit(1);
});