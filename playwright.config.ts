import { chromium, defineConfig, devices } from '@playwright/test';

// ADR-0008: gVisor環境ではChromiumのsyscall制限を回避するため起動設定を変更する
const isClaudeCodeRemote = process.env.CLAUDE_CODE_REMOTE === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: isClaudeCodeRemote ? 1 : process.env.CI ? 2 : 4, // ADR-0008
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // ADR-0008: gVisor環境ではヘッドレスシェルがクラッシュするため
        // フルChromiumを--no-zygote付きで起動する
        ...(isClaudeCodeRemote && {
          launchOptions: {
            executablePath: chromium.executablePath(),
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--no-zygote',
            ],
          },
        }),
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
