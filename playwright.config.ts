import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-gl=swiftshader'],
        },
      },
      // DOM-only tests work fine with SwiftShader
      testMatch: [
        'scaffold.spec.ts',
        'search.spec.ts',
        'theme-and-responsive.spec.ts',
        'accessibility.spec.ts',
        'panel-and-deeplink.spec.ts',
      ],
    },
    {
      name: 'chromium-gpu',
      use: {
        ...devices['Desktop Chrome'],
        // No SwiftShader — uses real GPU for WebGL2
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      // Map interaction tests need real GPU
      testMatch: ['map-and-countries.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
