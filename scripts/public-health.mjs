const ORIGIN='https://nexafia.com';

// No credentials, cookies, redirect following or response body are needed.
export async function checkPublicHealth(request=fetch) {
 const alerts=[];
 for(const [path,expected] of [['/api/health','health'],['/','gate']]) {
  try {
   const response=await request(ORIGIN+path,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10_000)});
   if(expected==='health' && response.status!==200) alerts.push('Nexafia no respondió correctamente al control público de disponibilidad.');
   if(expected==='gate' && (response.status!==401 || !/^Basic\b/i.test(response.headers.get('www-authenticate')||''))) alerts.push('No se pudo confirmar la protección de acceso al entorno de pruebas de Nexafia.');
   await response.body?.cancel();
  } catch {alerts.push(expected==='health'?'No se pudo comprobar la disponibilidad pública de Nexafia.':'No se pudo comprobar la protección de acceso al entorno de pruebas de Nexafia.');}
 }
 return alerts;
}
