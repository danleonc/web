import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
const title='¿Qué canción sería el tráiler de tu vida?';
async function seed(page:Page, hash='plaza') {
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('entre.prototype.v1',JSON.stringify({profile:{alias:'Luz',interests:['Música'],boundaries:[],availability:'Sin preferencia',adult:true},reservations:['cafe'],feedback:[],blocked:[]})));
  await page.goto(`/#${hash}`); await page.reload();
}
async function thread(page:Page) { await page.getByRole('button',{name:title,exact:true}).click();return page.getByRole('dialog',{name:title,exact:true}); }
async function sticker(page:Page, root:Locator, _plaza=false) {
  await root.getByRole('button',{name:'Abrir stickers',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Elige un sticker',exact:true});
  await picker.getByLabel('Buscar stickers').fill('Moka: Saludando');
  await picker.getByRole('button',{name:'Seleccionar sticker: Moka: Saludando',exact:true}).click();
  await picker.getByRole('button',{name:'Enviar sticker',exact:true}).click();
}
async function photo(page:Page, root:Locator, plaza=false) {
  await root.getByRole('button',{name:plaza?'Añadir una imagen':'Adjuntar imagen',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'foto.jpg',mimeType:'image/jpeg',buffer:await sharp({create:{width:500,height:400,channels:3,background:'#b78468'}}).jpeg().toBuffer()});
  await page.getByLabel('Descripción de la imagen').fill('Foto para responder con contexto');
  await page.getByRole('button',{name:plaza?'Adjuntar a mi respuesta':'Compartir imagen',exact:true}).click();
}
async function swipe(page:Page, target:Locator, dx:number, dy=0) {
  await target.scrollIntoViewIfNeeded();
  const box=(await target.boundingBox())!;
  const x=Math.max(40,box.x+20),y=box.y+Math.min(25,box.height/2);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx/2,y:y+dy/2}]});
  await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
}

test('Plaza: citar, cancelar sin perder borrador, guardar, recargar y volver al comentario',async({page})=>{
  await seed(page); let d=await thread(page);
  const original=d.getByRole('group',{name:'Respuesta de Javiera',exact:true});
  await original.getByRole('button',{name:'Responder',exact:true}).click();
  await expect(d.getByRole('group',{name:'Respondiendo a Javiera',exact:true})).toBeVisible();
  await expect(d.getByLabel('Tu respuesta de prueba')).toBeFocused();
  await d.getByLabel('Tu respuesta de prueba').fill('También guardo recuerdos de esos viajes.');
  await d.getByRole('button',{name:'Cancelar respuesta citada'}).click();
  await expect(d.getByLabel('Tu respuesta de prueba')).toHaveValue('También guardo recuerdos de esos viajes.');
  await original.getByRole('button',{name:'Responder',exact:true}).click();
  await d.getByRole('button',{name:'Guardar respuesta',exact:true}).click();
  const own=d.getByRole('group',{name:'Respuesta de ti',exact:true}).last();
  await own.getByRole('button',{name:'Ver mensaje original de Javiera'}).click();
  await expect(original).toBeFocused();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('entre.prototype.v1')!).plaza.comments[0]);
  expect(saved.replyTo).toBe('ejemplo-cancion'); expect(saved).not.toHaveProperty('quote');
  await page.reload(); d=await thread(page);
  await expect(d.getByRole('button',{name:'Ver mensaje original de Javiera'})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('Plaza: foto y sticker pueden citar; borrar el original o bloquearlo no restaura su contenido',async({page})=>{
  await seed(page); const d=await thread(page);
  await d.getByLabel('Tu respuesta de prueba').fill('Un recuerdo propio para citar');
  await d.getByRole('button',{name:'Guardar respuesta',exact:true}).click();
  const source=d.getByRole('group',{name:'Respuesta de ti',exact:true}).filter({has:page.locator('p').filter({hasText:/^Un recuerdo propio para citar$/})});
  await source.getByRole('button',{name:'Responder',exact:true}).click();
  await photo(page,d,true); await d.getByRole('button',{name:'Guardar respuesta',exact:true}).click();
  let image=d.getByRole('group',{name:'Respuesta de ti',exact:true}).last();
  await expect(image.locator('.reply-quote')).toContainText('Un recuerdo propio para citar');
  await image.getByRole('button',{name:'Responder',exact:true}).click();
  await sticker(page,d,true);
  await expect(d.getByRole('group',{name:'Respuesta de ti',exact:true}).last().locator('.reply-quote')).toContainText('Imagen');
  await source.getByRole('button',{name:'Eliminar mi respuesta',exact:true}).click();
  await expect(d.getByText('Mensaje original no disponible',{exact:true})).toBeVisible();
  await expect(d.getByText('Un recuerdo propio para citar',{exact:true})).toHaveCount(0);
  await d.getByRole('group',{name:'Respuesta de Javiera',exact:true}).getByRole('button',{name:'Responder',exact:true}).click();
  await d.getByLabel('Tu respuesta de prueba').fill('Respuesta sin copiar el comentario de origen');
  await d.getByRole('button',{name:'Guardar respuesta',exact:true}).click();
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('entre.prototype.v1')!);s.blocked=['pausa:Javiera'];localStorage.setItem('entre.prototype.v1',JSON.stringify(s));});
  await page.reload(); await thread(page);
  await expect(page.getByRole('button',{name:'Ver mensaje original de Javiera'})).toHaveCount(0);
});

test('sala: respuesta de texto, sticker e imagen con cita; gesto móvil respeta el desplazamiento vertical',async({page},info)=>{
  await seed(page,'agenda');
  await page.getByRole('button',{name:'Entrar a la sala de prueba',exact:true}).click();
  await expect(page.getByText(/Ya hay quórum:/)).toBeVisible();
  await page.getByRole('button',{name:'Comenzar encuentro de prueba',exact:true}).click();
  await page.getByRole('button',{name:'Mostrar una respuesta ficticia de ejemplo',exact:true}).click();
  const source=page.getByRole('group',{name:'Mensaje de Antonia',exact:true});
  if(info.project.name==='mobile'){
    await swipe(page,source.locator('p'),5,-75);
    await expect(page.getByRole('group',{name:'Respondiendo a Antonia'})).toHaveCount(0);
    await swipe(page,source.locator('p'),90,1);
  } else await source.getByRole('button',{name:'Responder',exact:true}).click();
  await expect(page.getByRole('group',{name:'Respondiendo a Antonia'})).toBeVisible();
  await page.getByLabel('Tu mensaje de prueba').fill('Me alegra responderte con contexto.');
  await page.getByRole('button',{name:'Enviar mensaje de prueba'}).click();
  const own=page.getByRole('group',{name:'Mensaje de ti',exact:true}).last();
  await own.getByRole('button',{name:'Ver mensaje original de Antonia'}).click();await expect(source).toBeFocused();
  await source.getByRole('button',{name:'Responder',exact:true}).click();
  await sticker(page,page.locator('.conversation'));
  await expect(page.getByRole('group',{name:'Mensaje de ti',exact:true}).last().locator('.reply-quote')).toContainText('Antonia');
  await source.getByRole('button',{name:'Responder',exact:true}).click();
  await photo(page,page.locator('.conversation'));
  const imageMessage=page.getByRole('group',{name:'Mensaje de ti',exact:true}).last();
  await expect(imageMessage.locator('.reply-quote')).toContainText('Antonia');
  if(info.project.name==='mobile') {
    await swipe(page,imageMessage.locator('.image-thumbnail'),90);
    await expect(page.getByRole('group',{name:'Respondiendo a Luz'})).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:'Cancelar respuesta citada'}).click();
  }
});

test('chat privado: citar conserva el borrador y consume la cita una sola vez',async({page},info)=>{
  await seed(page,'connections'); await page.getByRole('button',{name:'Probar chat privado',exact:true}).click();
  const d=page.getByRole('dialog',{name:'Chat privado de prueba'});
  await d.getByLabel('Tu mensaje de prueba').fill('Un primer mensaje propio');
  await d.getByRole('button',{name:'Enviar mensaje de prueba'}).click();
  const source=d.getByRole('group',{name:'Mensaje de ti',exact:true}).first();
  if(info.project.name==='mobile') await swipe(page,source.locator('p'),90);
  else await source.getByRole('button',{name:'Responder',exact:true}).click();
  await expect(d.getByRole('group',{name:'Respondiendo a Luz'})).toBeVisible();
  await d.getByLabel('Tu mensaje de prueba').fill('Este borrador queda después del sticker');
  await sticker(page,d);
  await expect(d.getByLabel('Tu mensaje de prueba')).toHaveValue('Este borrador queda después del sticker');
  await expect(d.getByRole('group',{name:'Respondiendo a Luz'})).toHaveCount(0);
  await expect(d.getByRole('group',{name:'Mensaje de ti',exact:true}).last().locator('.reply-quote')).toContainText('Un primer mensaje propio');
  await d.getByRole('button',{name:'Enviar mensaje de prueba'}).click();
  await expect(d.getByRole('group',{name:'Mensaje de ti',exact:true}).last().locator('.reply-quote')).toHaveCount(0);
  await d.getByRole('button',{name:'Ver mensaje original de Luz'}).click(); await expect(source).toBeFocused();
});

test('Plaza móvil: deslizar cita el comentario y las referencias importadas no cruzan publicaciones',async({page},info)=>{
  await seed(page);
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('entre.prototype.v1')!);s.plaza={posts:[],comments:[{id:'importada',postId:'cancion',author:'Luz',own:true,body:'Referencia de otra publicación',replyTo:'ejemplo-crear'}],saved:[],hidden:[],invitations:[]};localStorage.setItem('entre.prototype.v1',JSON.stringify(s));});
  await page.reload(); const d=await thread(page);
  await expect(d.getByRole('group',{name:'Respuesta de ti',exact:true}).locator('.reply-quote')).toHaveCount(0);
  const source=d.getByRole('group',{name:'Respuesta de Javiera',exact:true});
  if(info.project.name==='mobile') await swipe(page,source.locator('p').first(),90);
  else await source.getByRole('button',{name:'Responder',exact:true}).click();
  await expect(d.getByRole('group',{name:'Respondiendo a Javiera'})).toBeVisible();
  await page.keyboard.press('Escape'); await thread(page);
  await expect(page.getByRole('group',{name:'Respondiendo a Javiera'})).toHaveCount(0);
});
