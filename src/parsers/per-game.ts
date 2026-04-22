// Secondary per-game string formats that the main editors don't drive, but
// that the generic UI and the path-detection needs to understand well enough
// to count / list / validate.
//
// * mqs_enhance_list        -> "pkg:fps#mode"
// * cgame_df                -> "pkg@targetFps#temp:fps,temp:fps"
// * migt                    -> "pkg;cpuset;...;...;0:0 1:0 ..."   (7 semi-colon fields)
// * novatek_gex_fps_limit   -> "pkg:fps"
// * support_highfps_app     -> "pkg:fps"

export interface PkgFpsMode {
  pkg: string;
  fps: number;
  mode?: string;
}

export function parsePkgFpsMode(s: string): PkgFpsMode {
  const [pkgFps, mode] = s.split('#');
  const [pkg, fpsStr] = pkgFps.split(':');
  return { pkg, fps: Number(fpsStr) || 0, mode };
}
export function serializePkgFpsMode(v: PkgFpsMode): string {
  return v.mode === undefined ? `${v.pkg}:${v.fps}` : `${v.pkg}:${v.fps}#${v.mode}`;
}

export interface CgameDfRow {
  pkg: string;
  targetFps: number;
  steps: Array<{ temp: number; fps: number }>;
}

export function parseCgameDf(s: string): CgameDfRow {
  const [pkgAt, stepsStr] = s.split('#');
  const [pkg, targetStr] = pkgAt.split('@');
  const steps = (stepsStr ?? '')
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const [t, f] = pair.split(':');
      return { temp: Number(t), fps: Number(f) };
    });
  return { pkg, targetFps: Number(targetStr) || 0, steps };
}
export function serializeCgameDf(r: CgameDfRow): string {
  return `${r.pkg}@${r.targetFps}#${r.steps.map((s) => `${s.temp}:${s.fps}`).join(',')}`;
}

/** `pkg:fps` — shared by novatek_gex_fps_limit and support_highfps_app. */
export function parsePkgFps(s: string): { pkg: string; fps: number } {
  const [pkg, fps] = s.split(':');
  return { pkg, fps: Number(fps) || 0 };
}
export function serializePkgFps(v: { pkg: string; fps: number }): string {
  return `${v.pkg}:${v.fps}`;
}
