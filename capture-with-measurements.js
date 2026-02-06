const { chromium } = require('playwright');

async function captureWithMeasurements(cssVersion, outputPath) {
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
    
    // Type content
    const editor = page1.locator('.milkdown').locator('div[contenteditable="true"]').first();
    await editor.click();
    await page1.keyboard.type('Line 1 with some text');
    await page1.keyboard.press('Enter');
    await page1.keyboard.press('Enter');
    await page1.keyboard.type('Line 3 with some text');
    await page1.waitForTimeout(2500);
    
    // User 2: Open same page
    await page2.goto(url);
    await page2.waitForLoadState('networkidle');
    await page2.waitForSelector('.milkdown', { timeout: 10000 });
    await page2.waitForTimeout(2500);
    
    // User 2: Get all paragraphs and click on the second one (empty line)
    const paragraphs = await page2.locator('.ProseMirror p').all();
    console.log(`Found ${paragraphs.length} paragraphs`);
    
    if (paragraphs.length >= 2) {
      // Click directly on the empty paragraph (line 2)
      await paragraphs[1].click();
      console.log('Clicked on empty paragraph (line 2)');
      await page2.waitForTimeout(2000);
    }
    
    // Measure paragraph heights from User 1's perspective
    const p1Paragraphs = await page1.locator('.ProseMirror p').all();
    for (let i = 0; i < p1Paragraphs.length; i++) {
      const box = await p1Paragraphs[i].boundingBox();
      const text = await p1Paragraphs[i].textContent();
      console.log(`Paragraph ${i + 1}: height=${box?.height}px, text="${text}"`);
    }
    
    // Take screenshot
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
  await captureWithMeasurements(cssVersion, outputPath);
})();
