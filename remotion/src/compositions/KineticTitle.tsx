import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_STACK, Ratio, clamp, safeRatio} from '../lib/ratio';
import {withAlpha} from '../lib/color';

export type KineticTitleProps = {
  title: string;
  subtitle: string;
  textColor: string;
  accentColor: string;
  backgroundColor: string;
  durationSeconds: number;
  ratio: Ratio;
};

export const kineticTitleDefaults: KineticTitleProps = {
  title: 'Ide besar dimulai dari langkah kecil',
  subtitle: 'Remotion di Cloudflare + GitHub Actions',
  textColor: '#ffffff',
  accentColor: '#ffd400',
  backgroundColor: '#101826',
  durationSeconds: 5,
  ratio: '9:16',
};

export const normalizeKinetic = (props: Partial<KineticTitleProps>): KineticTitleProps => ({
  ...kineticTitleDefaults,
  ...props,
  durationSeconds: clamp(props.durationSeconds as number, 2, 20, kineticTitleDefaults.durationSeconds),
  ratio: safeRatio(props.ratio),
});

export const KineticTitle: React.FC<KineticTitleProps> = (input) => {
  const p = normalizeKinetic(input);
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();

  const unit = Math.min(width, height) / 1080;
  const portrait = height > width;
  const words = (p.title.trim() || kineticTitleDefaults.title).split(' ').filter(Boolean);
  const fontSize = (words.length > 8 ? 96 : words.length > 4 ? 124 : 156) * unit * (portrait ? 1 : 0.92);

  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const drift = interpolate(frame, [0, durationInFrames], [20, 80]);
  const barSpring = spring({frame: frame - 6, fps, config: {damping: 200}});
  const subStart = words.length * 5 + 12;
  const subSpring = spring({frame: frame - subStart, fps, config: {damping: 200}});

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${drift}% ${100 - drift}%, ${withAlpha(p.accentColor, 0.35)} 0%, rgba(0,0,0,0) 55%), ${p.backgroundColor}`,
        fontFamily: FONT_STACK,
        opacity: exit,
      }}
    >
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', padding: 90 * unit, textAlign: 'center'}}
      >
        <div style={{fontSize, fontWeight: 900, lineHeight: 1.12, color: p.textColor}}>
          {words.map((word, i) => {
            const s = spring({frame: frame - i * 5, fps, config: {damping: 12, stiffness: 120}});
            const y = interpolate(s, [0, 1], [90 * unit, 0]);
            const rotate = interpolate(s, [0, 1], [i % 2 ? 6 : -6, 0]);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  margin: `0 ${fontSize * 0.12}px`,
                  opacity: Math.min(s, 1),
                  transform: `translateY(${y}px) rotate(${rotate}deg)`,
                  color: i === words.length - 1 ? p.accentColor : p.textColor,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            height: 14 * unit,
            width: 260 * unit * barSpring,
            background: p.accentColor,
            borderRadius: 99,
            marginTop: 56 * unit,
          }}
        />
        <div
          style={{
            marginTop: 44 * unit,
            fontSize: 52 * unit,
            fontWeight: 600,
            color: p.textColor,
            opacity: Math.min(subSpring, 1) * 0.85,
            transform: `translateY(${(1 - subSpring) * 30 * unit}px)`,
          }}
        >
          {p.subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
