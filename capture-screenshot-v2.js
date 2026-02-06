const { chromium } = require('playwright');

async function captureScreenshot(cssVersion, outputPath) {
  console.log(`Capturing screenshot for ${cssVersion}...`);
  
  const browser = await chromium.launch({ headless: true });
  const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  try {
    // User 1: Create a new page
    await page1.goto('http://localhost:3000');
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);
    
    // Click create button
    await page1.click('button[title="新しいページを作成"]');
    await page1.waitForURL(/\/page\/.+/);
    await page1.waitForSelector('.milkdown', { timeout: 10000 });
    await page1.waitForTimeout(2000);
    
    const url = page1.url();
    console.log('Created page:', url);
    
    // Type content line by line with explicit cursor positioning
    const editor = page1.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor.click();
    
    // Type Line 1
    await page1.keyboard.type('Line 1 with some text');
    await page1.keyboard.press('Enter');
    console.log('Typed line 1, pressed Enter');
    
    // Create empty line (press Enter again)
    await page1.keyboard.press('Enter');
    console.log('Created empty line 2, pressed Enter again');
    
    // Type Line 3
    await page1.keyboard.type('Line 3 with some text');
    console.log('Typed line 3');
    
    await page1.waitForTimeout(2500);
    
    // User 2: Open same page
    await page2.goto(url);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2500);
    
    // User 2: Click at beginning of document
    const editor2 = page2.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor2.click();
    await page2.waitForTimeout(500);
    
    // Move to line 2 (empty line) - press Down once from line 1
    console.log('User 2: Moving cursor to empty line 2...');
    await page2.keyboard.press('ArrowDown');
    await page2.waitForTimeout(500);
    
    // Wait for cursor to sync
    await page1.waitForTimeout(2000);
    
    // Take screenshot from User 1's perspective
    await page1.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width: 800, height: 350 }
    });
    console.log('Screenshot saved:', outputPath);
    
  } finally {
    await browser.close();
  }
}

(async () => {
  const cssVersion = process.argv[2] || 'after';
  const outputPath = process.argv[3] || `/tmp/${cssVersion}-fix.png`;
  await captureScreenshot(cssVersion, outputPath);
})();
