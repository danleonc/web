import { test, expect } from '@playwright/test';
test('la protección permite abrir una sala desde el navegador autenticado', async ({ browser }, info) => {
  const password = '0123456789abcdef0123456789abcdef0123456789abcdef';
  const ctx = await browser.newContext({ ...info.project.use, baseURL:'http://127.0.0.1:4190', httpCredentials:{username:'nexafia',password} });
  try {
    const headers = { Origin:'http://127.0.0.1:4190', Authorization:'Basic ' + Buffer.from('nexafia:' + password).toString('base64') };
    expect((await ctx.request.post('/api/auth/login',{headers,data:{username:'moderator_fixture',password:'Una clave exclusiva del fixture 123'}})).status()).toBe(200);
    expect((await ctx.request.post('/api/reservations/cafe',{headers})).status()).toBe(200);
    const page = await ctx.newPage(); await page.goto('/');
    await expect(page.getByRole('heading',{name:/Las buenas conexiones empiezan compartiendo/})).toBeVisible();
    const connected = await page.evaluate(() => new Promise<boolean>(resolve => { const socket = new WebSocket(`ws://${location.host}/api/rooms/cafe`); socket.onopen=()=>{socket.close();resolve(true);}; socket.onerror=()=>resolve(false); setTimeout(()=>resolve(false),5000); }));
    expect(connected).toBe(true);
  } finally { await ctx.close(); }
});
