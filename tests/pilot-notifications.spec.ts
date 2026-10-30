import AxeBuilder from "@axe-core/playwright";
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {confirmTestEmail} from './pilot-email';
async function mockDevice(page:Page, denied=false) {
 await page.addInitScript(({denied})=>{
  const state={requests:0,sub:null as null|{endpoint:string;toJSON:()=>unknown;unsubscribe:()=>Promise<boolean>}};
  (window as Window & {__pushTest?:typeof state}).__pushTest=state;
  class Permission {static permission='default';static async requestPermission(){state.requests++;this.permission=denied?'denied':'granted';return this.permission;}}
  Object.defineProperty(window,'Notification',{value:Permission,configurable:true});
  Object.defineProperty(window,'PushManager',{value:class {},configurable:true});
  const registration={active:{state:'activated'},pushManager:{getSubscription:async()=>state.sub,subscribe:async(options:{applicationServerKey:Uint8Array})=>{
   const raw=Array.from(options.applicationServerKey).map(n=>String.fromCharCode(n)).join('');
   const publicKey=btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
   const endpoint='https://fcm.googleapis.com/fcm/send/ui-'+crypto.randomUUID();
   const sub={endpoint,toJSON:()=>({endpoint,expirationTime:null,keys:{p256dh:publicKey,auth:btoa(String.fromCharCode(...new Uint8Array(16))).replace(/=/g,'')}}),unsubscribe:async()=>{if(state.sub===sub)state.sub=null;return true;}};
   state.sub=sub;return sub;
  }}};
  const service=Object.assign(new EventTarget(),{register:async()=>registration,getRegistration:async()=>registration,ready:Promise.resolve(registration)});
  Object.defineProperty(navigator,'serviceWorker',{value:service,configurable:true});
 },{denied});
}
async function signup(page:Page,name:string){
 await page.getByRole('button',{name:/^(Entrar|Mi cuenta)$/,exact:true}).click();
 const access=page.getByRole('dialog',{name:'Tu cuenta en Nexafia',exact:true});
 await access.getByRole('button',{name:'Crear cuenta',exact:true}).click();
 await access.getByLabel('Usuario',{exact:true}).fill(name);await access.getByLabel('Nombre en la sala',{exact:true}).fill(name);
 await access.getByLabel('Contraseña',{exact:true}).fill('Una frase larga para acceder 123');await access.getByRole('checkbox',{name:/Declaro que soy mayor de 18 años/}).check();
 await access.getByRole('button',{name:'Guardar mi cuenta',exact:true}).click();await confirmTestEmail(page,name);
 await access.getByRole('button',{name:'Continuar en Nexafia',exact:true}).click();
}
test('avisos separados por cuenta y teléfono voluntario, prueba/baja propia sin permisos al entrar',async({page},info)=>{
 test.setTimeout(60_000);await mockDevice(page);await page.goto('/');
 const prefix='avisos_'+info.project.name.replaceAll('-','_');await signup(page,prefix+'_a');
 expect(await page.evaluate(()=>(window as Window & {__pushTest?:{requests:number}}).__pushTest!.requests)).toBe(0);
 await page.getByRole('button',{name:'Notificaciones, sin avisos sin leer',exact:true}).click();const center=page.getByRole('dialog',{name:'Notificaciones',exact:true});
 await center.getByText('Probar las notificaciones de la maqueta',{exact:true}).click();await center.getByRole('button',{name:'Probar un aviso de ejemplo',exact:true}).click();
 const ownA=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('entre.prototype.v1')!).notifications).find(id=>id.startsWith('account:'))!);
 await center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true}).scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('phone-settings.png')});
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true}).click();await expect(center.getByText('Este dispositivo quedó activado.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as Window & {__pushTest?:{requests:number}}).__pushTest!.requests)).toBe(1);
 await center.getByRole('button',{name:'Enviar prueba a mi dispositivo',exact:true}).click();await expect(center.getByText(/Prueba enviada al servicio/)).toBeVisible();
 await page.route('**/api/push/test',route=>route.fulfill({status:410,contentType:'application/json',body:JSON.stringify({error:'device_expired'})}));
 await center.getByRole('button',{name:'Enviar prueba a mi dispositivo',exact:true}).click();
 await expect(center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true})).toBeVisible();
 await page.unroute('**/api/push/test');
 await center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true}).click();
 await page.route('**/api/push/unsubscribe',route=>route.abort('failed'));
 await center.getByRole('button',{name:'Desactivar este dispositivo',exact:true}).click();await expect(center.getByText('Avisos desactivados en este dispositivo.',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as Window & {__pushTest?:{sub:unknown}}).__pushTest!.sub)).toBeNull();
 await page.unroute('**/api/push/unsubscribe');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.keyboard.press('Escape');
 await signup(page,prefix+'_b');await page.getByRole('button',{name:'Notificaciones, sin avisos sin leer',exact:true}).click();await expect(center.getByText('Aviso de ejemplo',{exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Cómo funciona',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar mis datos de prueba',exact:true}).click();
 const stream=await(await download).createReadStream();let text='';for await(const chunk of stream!)text+=chunk.toString();expect(JSON.parse(text).notifications).not.toHaveProperty(ownA);
});
test('denegar permiso no activa dispositivo ni repite la petición automáticamente',async({page},info)=>{
 await mockDevice(page,true);await page.goto('/');await signup(page,'denied_'+info.project.name.replaceAll('-','_'));
 await page.getByRole('button',{name:'Notificaciones, sin avisos sin leer',exact:true}).click();
 const center=page.getByRole('dialog',{name:'Notificaciones',exact:true});await center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true}).click();
 await expect(center.getByText(/El permiso está bloqueado/)).toBeVisible();await expect(center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as Window & {__pushTest?:{requests:number}}).__pushTest!.requests)).toBe(1);
});
test('iPhone fuera de pantalla de inicio recibe instrucciones sin solicitar permisos',async({page},info)=>{
 await mockDevice(page);await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1',configurable:true}));
 await page.goto('/');await signup(page,'iphone_'+info.project.name.replaceAll('-','_'));
 await page.getByRole('button',{name:'Notificaciones, sin avisos sin leer',exact:true}).click();
 const center=page.getByRole('dialog',{name:'Notificaciones',exact:true});
 await expect(center.getByText(/Se requiere iOS\/iPadOS 16.4 o posterior/)).toBeVisible();
 await page.screenshot({path:info.outputPath('phone-iphone-install.png')});
 await expect(center.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as Window & {__pushTest?:{requests:number}}).__pushTest!.requests)).toBe(0);
});
