import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_STACK, FPS, Ratio, clamp, safeRatio} from '../lib/ratio';
import {withAlpha} from '../lib/color';

export type Slide = {title: string; body?: string};

export type TikTokSlidesProps = {
  slides: Slide[];
  handle: string;
  textColor: string;
  accentColor: string;
  backgroundColor: string;
  secondsPerSlide: number;
  ratio: Ratio;
};

export const tikTokSlidesDefaults: TikTokSlidesProps = {
  slides: [
    {title: 'Stop scroll!', body: '3 tips video cepat'},
    {title: '1. Hook kuat', body: 'Tiga detik pertama menentukan'},
    {title: '2. Teks besar', body: 'Mudah dibaca di layar kecil'},
    {title: '3. Ajak aksi', body: 'Follow untuk tips berikutnya'},
  ],
  handle: '@username',
  textColor: '#ffffff',
  accentColor: '#ff3b6b',
  backgroundColor: '#0b0b12',
  secondsPerSlide: 2.5,
  ratio: '9:16',
};

export const normalizeSlides = (props: Partial<TikTokSlidesProps>): TikTokSlidesProps => {
  const slides = (Array.isArray(props.slides) ? props.slides : [])
    .filter((s) => s && typeof s.title === 'string' && s.title.trim() !== '')
    .slice(0, 12);
  return {
    ...tikTokSlidesDefaults,
    ...props,
    slides: slides.length ? slides : tikTokSlidesDefaults.slides,
    secondsPerSlide: clamp(props.secondsPerSlide as number, 1, 8, tikTokSlidesDefaults.secondsPerSlide),
    ratio: safeRatio(props.ratio),
  };
};

export const framesPerSlide = (p: TikTokSlidesProps) => Math.round(p.secondsPerSlide * FPS);

const SlideView: React.FC<{slide: Slide; index: number; p: TikTokSlidesProps}> = ({slide, index, p}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const portrait = height > width;

  const pop = spring({frame, fps, config: {damping: 10, stiffness: 140}});
  const bodySpring = spring({frame: frame - 8, fps, config: {damping: 200}});
  const fadeIn = interpolate(frame, [0, 5], [0, 1], {extrapolateRight: 'clamp'});

  const len = slide.title.length;
  const titleSize = (len > 36 ? 84 : len > 20 ? 104 : 128) * unit * (portrait ? 1 : 0.85);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${20 + index * 20}% ${index % 2 ? 75 : 25}%, ${withAlpha(p.accentColor, 0.3)} 0%, rgba(0,0,0,0) 60%), ${p.backgroundColor}`,
        opacity: fadeIn,
        justifyContent: 'center',
        alignItems: portrait ? 'center' : 'flex-start',
        padding: `${(portrait ? 260 : 140) * unit}px ${(portrait ? 90 : 160) * unit}px`,
        textAlign: portrait ? 'center' : 'left',
      }}
    >
      <div
        style={{
          transform: `scale(${0.6 + 0.4 * Math.min(pop, 1.08)})`,
          transformOrigin: portrait ? 'center' : 'left center',
        }}
      >
        <span
          style={{
            background: p.accentColor,
            color: p.backgroundColor,
            fontSize: titleSize,
            fontWeight: 900,
            lineHeight: 1.3,
            padding: `0 ${0.18 * titleSize}px`,
            borderRadius: 0.16 * titleSize,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {slide.title}
        </span>
      </div>
      {slide.body ? (
        <div
          style={{
            marginTop: 56 * unit,
            fontSize: 56 * unit,
            fontWeight: 600,
            lineHeight: 1.3,
            color: p.textColor,
            opacity: Math.min(bodySpring, 1),
            transform: `translateY(${(1 - bodySpring) * 40 * unit}px)`,
          }}
        >
          {slide.body}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const TikTokSlides: React.FC<TikTokSlidesProps> = (input) => {
  const p = normalizeSlides(input);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const portrait = height > width;
  const per = framesPerSlide(p);
  const side = (portrait ? 60 : 120) * unit;

  return (
    <AbsoluteFill style={{fontFamily: FONT_STACK, backgroundColor: p.backgroundColor}}>
      {p.slides.map((slide, i) => (
        <Sequence key={i} from={i * per} durationInFrames={per}>
          <SlideView slide={slide} index={i} p={p} />
        </Sequence>
      ))}
      <div
        style={{
          position: 'absolute',
          top: (portrait ? 150 : 50) * unit,
          left: side,
          right: side,
          display: 'flex',
          gap: 8 * unit,
        }}
      >
        {p.slides.map((_, i) => {
          const fill = interpolate(frame, [i * per, (i + 1) * per], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 10 * unit,
                borderRadius: 99,
                overflow: 'hidden',
                background: withAlpha(p.textColor, 0.25),
              }}
            >
              <div style={{width: `${fill * 100}%`, height: '100%', background: p.textColor}} />
            </div>
          );
        })}
      </div>
      {p.handle ? (
        <div
          style={{
            position: 'absolute',
            left: side,
            bottom: (portrait ? 230 : 60) * unit,
            display: 'flex',
            alignItems: 'center',
            gap: 20 * unit,
            color: p.textColor,
            fontSize: 44 * unit,
            fontWeight: 700,
          }}
        >
          <div style={{width: 64 * unit, height: 64 * unit, borderRadius: 99, background: p.accentColor}} />
          <span>{p.handle}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
