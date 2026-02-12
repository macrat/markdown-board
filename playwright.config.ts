import { chromium, defineConfig, devices } from '@playwright/test';
import { TEST_DB_PATH } from './e2e/global-setup';

const TEST_PORT = 3100;
const TEST_WS_PORT = 1334;

// ADR-0008: gVisor環境ではChromiumのsyscall制限を回避するため起動設定を変更する
const isClaudeCodeRemote = process.env.CLAUDE_CODE_REMOTE === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: isClaudeCodeRemote ? 1 : process.env.CI ? 2 : 4, // ADR-0008
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
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
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NEXT_PUBLIC_WS_PORT: String(TEST_WS_PORT),
      DATABASE_PATH: TEST_DB_PATH,
    },
  },
});
