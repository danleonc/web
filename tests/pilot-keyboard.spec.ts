import { test, expect } from '@playwright/test';

test('los campos de cuenta mantienen tamaño, foco y borrador al reducir el espacio vertical', async ({page},info)=>{
  await page.goto('/#shared');
  const mobile=info.project.name==='pilot-mobile',username=page.getByLabel('Usuario',{exact:true}),password=page.getByLabel('Contraseña',{exact:true});
  for(const field of [username,password]) {
    if(mobile) expect(await field.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    await field.focus();await expect(field).toBeFocused();
  }
  await username.fill('prueba_teclado');await password.fill('Un borrador de contraseña local 123');
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  const alias=page.getByLabel('Nombre en la sala',{exact:true});
  if(mobile) expect(await alias.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  await alias.fill('Luz');
  // Switching authentication mode intentionally clears the password. Start the
  // keyboard/height check with a draft entered in the selected mode.
  await password.fill('Un borrador de contraseña local 123');await password.focus();const size=page.viewportSize()!,width=await password.evaluate(e=>e.getBoundingClientRect().width);
  await page.setViewportSize({width:size.width,height:430});await password.scrollIntoViewIfNeeded();
  await expect(password).toBeFocused();await expect(username).toHaveValue('prueba_teclado');
  await expect(password).toHaveValue('Un borrador de contraseña local 123');
  expect(Math.abs(width-await password.evaluate(e=>e.getBoundingClientRect().width))).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
  await page.setViewportSize(size);
});
