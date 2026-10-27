import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function stableFocus(page: Page, field: Locator, mobile: boolean) {
  const before = await field.evaluate(e => ({
    font: parseFloat(getComputedStyle(e).fontSize),
    width: e.getBoundingClientRect().width,
    viewportWidth: window.visualViewport?.width || innerWidth,
    scale: window.visualViewport?.scale || 1,
  }));
  if (mobile) expect(before.font).toBeGreaterThanOrEqual(16);
  await field.focus();
  await expect(field).toBeFocused();
  const after = await field.evaluate(e => ({
    font: parseFloat(getComputedStyle(e).fontSize),
    width: e.getBoundingClientRect().width,
    viewportWidth: window.visualViewport?.width || innerWidth,
    scale: window.visualViewport?.scale || 1,
  }));
  expect(after.font).toBe(before.font);
  expect(Math.abs(after.width-before.width)).toBeLessThan(1);
  expect(after.scale).toBe(before.scale);
  expect(Math.abs(after.viewportWidth-before.viewportWidth)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('campos de perfil y stickers se enfocan sin cambiar escala o ancho; el chat conserva borrador con menos altura', async ({page}, info) => {
  const mobile=info.project.name==='mobile';
  await page.goto('/#profile');
  const meta=await page.locator('meta[name=viewport]').getAttribute('content');
  expect(meta).toContain('width=device-width');
  expect(meta).not.toMatch(/user-scalable\s*=\s*no|maximum-scale|minimum-scale/);
  const alias=page.getByLabel('¿Cómo te llamamos?');
  await stableFocus(page,alias,mobile); await alias.fill('Luz');
  await stableFocus(page,page.getByLabel('¿Cuándo te acomoda participar?'),mobile);
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByLabel('Declaro que soy mayor de 18 años').check();
  await page.getByRole('button',{name:'Guardar mi perfil',exact:true}).click();
  await page.goto('/#connections');
  await page.getByRole('button',{name:'Probar chat privado',exact:true}).click();
  const chat=page.getByRole('dialog',{name:'Chat privado de prueba'}),input=chat.getByLabel('Tu mensaje de prueba');
  await stableFocus(page,input,mobile);await input.fill('Un borrador que no se pierde al escribir.');
  await chat.getByRole('button',{name:'Abrir stickers',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Elige un sticker'}),search=picker.getByLabel('Buscar stickers');
  await stableFocus(page,search,mobile);await search.fill('abrazo');
  await expect(picker.getByRole('button',{name:/^Seleccionar sticker:/}).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('Un borrador que no se pierde al escribir.');
  await input.focus();
  const size=page.viewportSize()!,width=await input.evaluate(e=>e.getBoundingClientRect().width);
  // Reduced height checks layout recovery, not iOS keyboard emulation.
  await page.setViewportSize({width:size.width,height:430});
  await input.scrollIntoViewIfNeeded();await expect(input).toBeFocused();
  expect(Math.abs(width-await input.evaluate(e=>e.getBoundingClientRect().width))).toBeLessThan(1);
  await expect(input).toHaveValue('Un borrador que no se pierde al escribir.');
  expect(await chat.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.setViewportSize(size);
  await chat.getByRole('button',{name:'Enviar mensaje de prueba'}).click();
  await expect(chat.getByText('Un borrador que no se pierde al escribir.',{exact:true})).toBeVisible();
});
