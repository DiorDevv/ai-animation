import { Body, Equator, Horizon, Illumination, MoonPhase, Observer, SiderealTime } from 'astronomy-engine';
import catalog from './data/stars.json';

const RAD = Math.PI / 180;
const MOON_TURN = 14; // Oy old tomonda biroz chapda ko‘rinadi

/** Berilgan kun va joydan osmon qanday ko‘ringanini hisoblaydi. */
export function computeSky({ date, lat, lon }) {
  const when = new Date(date);
  const observer = new Observer(lat, lon, 455);
  const lst = SiderealTime(when) * 15 + lon;

  const moonEq = Equator(Body.Moon, when, observer, true, true);
  const moonSky = Horizon(when, observer, moonEq.ra, moonEq.dec, 'normal');
  const moonUp = moonSky.altitude > 0;
  // Osmon butunligicha buriladi, yulduzlar orasidagi joylashuv o‘zgarmaydi.
  const facing = moonUp ? moonSky.azimuth + MOON_TURN : 180;

  const toWorld = (alt, az) => {
    const a = (az - facing) * RAD;
    const c = Math.cos(alt * RAD);
    return [Math.sin(a) * c, Math.sin(alt * RAD), -Math.cos(a) * c];
  };

  const project = (raDeg, decDeg) => {
    const h = (lst - raDeg) * RAD;
    const d = decDeg * RAD;
    const phi = lat * RAD;
    const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
    const alt = Math.asin(sinAlt) / RAD;
    const az = Math.atan2(-Math.cos(d) * Math.sin(h), Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.cos(h) * Math.sin(phi)) / RAD;
    return { alt, az, dir: toWorld(alt, az) };
  };

  const stars = [];
  for (let i = 0; i < catalog.length; i += 4) {
    const p = project(catalog[i], catalog[i + 1]);
    if (p.alt > 1) stars.push({ dir: p.dir, alt: p.alt, az: p.az, mag: catalog[i + 2], kelvin: catalog[i + 3] });
  }

  return {
    stars,
    moon: {
      // Fazasi va tomoni aniq; balandligi esa Oy doim kadrga sig'ishi uchun cheklanadi.
      dir: toWorld(moonUp ? Math.min(17, Math.max(10, moonSky.altitude)) : 15, facing - MOON_TURN),
      phaseAngle: Illumination(Body.Moon, when).phase_angle,
      waxing: MoonPhase(when) < 180,
    },
  };
}
