import base from './playwright.real-plaza.config';
import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NEXAFIA_TEST_CLOCK_SPEED = '300';
process.env.NEXAFIA_TEST_CLOCK_FILE ||= join(tmpdir(), `nexafia-test-clock-${randomUUID()}`);
export default defineConfig({
  ...base,
  webServer: { ...base.webServer as object, env: { ...process.env, NEXAFIA_TEST_PLAZA: '1', NEXAFIA_TEST_PROFILE_PHOTOS: '1', NEXAFIA_TEST_CLOCK_SPEED: '300', NEXAFIA_TEST_GROUP_REUNIONS: '1' } },
});
