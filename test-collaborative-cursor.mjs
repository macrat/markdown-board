import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  
  // Open first tab and create a page with multiple lines
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto('http://localhost:3000');
  await page1.waitForTimeout(2000);
  
  // Create new page
  await page1.click('text=New Page');
  await page1.waitForTimeout(3000);
  
  // Type multiple lines
  const editor = page1.locator('.milkdown .ProseMirror');
  await editor.click();
  await page1.keyboard.type('First Line');
  await page1.keyboard.press('Enter');
  await page1.keyboard.type('Second Line');
  await page1.keyboard.press('Enter');
  await page1.keyboard.type('Third Line');
  await page1.keyboard.press('Enter');
  await page1.keyboard.type('Fourth Line');
  await page1.waitForTimeout(2000);
  
  const url = page1.url();
  console.log('Created page at:', url);
  
  // Open second tab
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(url);
  await page2.waitForTimeout(3000);
  
  // In first tab, move cursor to the first line
  await page1.bringToFront();
  const editorPage1 = page1.locator('.milkdown .ProseMirror');
  await editorPage1.click({ position: { x: 10, y: 10 } }); // Click at top of editor
  await page1.waitForTimeout(1000);
  
  // Take screenshot from second tab showing the collaborative cursor
  await page2.bringToFront();
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: 'collaborative-cursor-test.png', fullPage: true });
  
  console.log('Screenshot saved as collaborative-cursor-test.png');
  
  // Keep browsers open for 10 seconds for manual inspection
  await page2.waitForTimeout(10000);
  
  await browser.close();
})();
