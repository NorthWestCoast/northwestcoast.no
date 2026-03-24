interface WaveProps {
  /** Background colour behind the wave (above) */
  top?: string;
  /** Background colour below the wave */
  bottom?: string;
  /** Primary SVG path (fills "bottom" colour) */
  path?: string;
  /** Dual-layer wave – renders two <path> elements */
  dual?: boolean;
  topPath?: string;
  dualTopFill?: string;
  dualBottomFill?: string;
}

export default function Wave({
  top,
  bottom,
  path,
  dual = false,
  topPath,
  dualTopFill,
  dualBottomFill,
}: WaveProps) {
  const wrapStyle = top ? { background: top } : undefined;

  if (dual && topPath && dualTopFill && dualBottomFill) {
    const bottomPath = topPath
      .replace('L1440,70 L0,70Z', 'L1440,0 L0,0Z')
      .replace('L1440,0 L0,0Z', 'L1440,70 L0,70Z');

    return (
      <div className="wave" style={wrapStyle}>
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" fill="none">
          <path d={topPath.replace('L1440,70 L0,70Z', 'L1440,0 L0,0Z')} fill={dualTopFill} />
          <path d={topPath} fill={dualBottomFill} />
        </svg>
      </div>
    );
  }

  const singlePath = path ?? 'M0,40 C480,80 960,10 1440,50 L1440,70 L0,70Z';
  const fill = bottom ?? 'var(--sand)';

  return (
    <div className="wave" style={wrapStyle}>
      <svg viewBox="0 0 1440 70" preserveAspectRatio="none" fill="none">
        <path d={singlePath} fill={fill} />
      </svg>
    </div>
  );
}
