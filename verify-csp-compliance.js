#!/usr/bin/env node

// Verify that generated HTML is CSP-compliant (no inline event handlers)
// Run with: node verify-csp-compliance.js

import fs from 'fs';

function verifyCspCompliance(htmlFile) {
  console.log(`🔍 Checking CSP compliance for: ${htmlFile}\n`);
  
  try {
    const html = fs.readFileSync(htmlFile, 'utf-8');
    
    // Check for inline event handlers
    const inlineHandlers = [
      'onclick=',
      'onload=',
      'onchange=',
      'onsubmit=',
      'onmouseover=',
      'onmouseout=',
      'onfocus=',
      'onblur=',
      'onkeydown=',
      'onkeyup='
    ];
    
    let violations = [];
    
    for (const handler of inlineHandlers) {
      const regex = new RegExp(handler, 'gi');
      const matches = html.match(regex);
      if (matches) {
        violations.push({
          handler,
          count: matches.length
        });
      }
    }
    
    // Check for javascript: URLs
    const jsUrls = html.match(/href\s*=\s*["']javascript:/gi);
    if (jsUrls) {
      violations.push({
        handler: 'javascript: URLs',
        count: jsUrls.length
      });
    }
    
    // Results
    if (violations.length === 0) {
      console.log('✅ CSP Compliance Check: PASSED');
      console.log('   No inline event handlers found');
      console.log('   No javascript: URLs found');
      console.log('   HTML is CSP-compliant! 🎉\n');
    } else {
      console.log('❌ CSP Compliance Check: FAILED');
      console.log('   Found the following violations:\n');
      
      for (const violation of violations) {
        console.log(`   - ${violation.handler}: ${violation.count} occurrence(s)`);
      }
      console.log();
    }
    
    // Additional checks
    console.log('📊 Additional Information:');
    console.log(`   - File size: ${(html.length / 1024).toFixed(1)} KB`);
    console.log(`   - Contains <script> tags: ${html.includes('<script>') ? 'Yes' : 'No'}`);
    console.log(`   - Uses event listeners: ${html.includes('addEventListener') ? 'Yes' : 'No'}`);
    console.log(`   - Uses proper button IDs: ${html.includes('id="human-view-btn"') ? 'Yes' : 'No'}`);
    
    return violations.length === 0;
    
  } catch (error) {
    console.error('❌ Error reading file:', error.message);
    return false;
  }
}

// Check the specified file or default to test output
const testFile = process.argv[2] || 'test-output.html';
if (fs.existsSync(testFile)) {
  const isCompliant = verifyCspCompliance(testFile);
  process.exit(isCompliant ? 0 : 1);
} else {
  console.log(`❌ File not found: ${testFile}`);
  console.log('   Run the test script first: node test-repo-flatten.js');
  process.exit(1);
}