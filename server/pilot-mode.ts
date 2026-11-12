type BuildMarker = { mode?: unknown; realPlaza?: unknown };
export function pilotMode(env: NodeJS.ProcessEnv, marker: BuildMarker) {
  if (marker.mode !== 'accounts') throw Error('Invalid pilot build');
  const raw = env.ENTRE_STAGING_SHARED;
  if (raw !== undefined && raw !== '0' && raw !== '1') throw Error('invalid staging mode');
  const shared = raw === '1';
  if (shared && !env.ENTRE_STAGING_PASSWORD) throw Error('shared mode requires staging protection');
  if ((marker.realPlaza === true) !== shared) throw Error('pilot build mismatch');
  return { plazaEnabled: shared, meetingsEnabled: shared };
}
