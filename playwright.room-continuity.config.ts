import base from './playwright.real-plaza.config';
import { defineConfig } from '@playwright/test';

process.env.NEXAFIA_TEST_CLOCK_SPEED = '300';
export default defineConfig({
  ...base,
  webServer: { ...base.webServer as object, env: { ...process.env, NEXAFIA_TEST_PLAZA: '1', NEXAFIA_TEST_PROFILE_PHOTOS: '1', NEXAFIA_TEST_CLOCK_SPEED: '300' } },
});
