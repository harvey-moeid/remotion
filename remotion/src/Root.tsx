import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {FPS, clamp, dimensions, safeRatio} from './lib/ratio';
import {
  KineticTitle,
  KineticTitleProps,
  kineticTitleDefaults,
  normalizeKinetic,
} from './compositions/KineticTitle';
import {
  TikTokSlides,
  TikTokSlidesProps,
  framesPerSlide,
  normalizeSlides,
  tikTokSlidesDefaults,
} from './compositions/TikTokSlides';
import UserCode, * as userModule from './custom/UserCode';

// Dimensi dan durasi dihitung dari props (ratio, durationSeconds, jumlah slide).
const kineticMeta: CalculateMetadataFunction<KineticTitleProps> = ({props}) => {
  const p = normalizeKinetic(props);
  return {durationInFrames: Math.round(p.durationSeconds * FPS), ...dimensions(p.ratio)};
};

const slidesMeta: CalculateMetadataFunction<TikTokSlidesProps> = ({props}) => {
  const p = normalizeSlides(props);
  return {durationInFrames: p.slides.length * framesPerSlide(p), ...dimensions(p.ratio)};
};

// Template "CustomCode": durasi/ukuran dibaca dari `export const config` milik kode pengguna;
// bila tidak ada, dipakai bawaan (150 frame, 30 fps, ukuran mengikuti rasio).
type CustomConfig = {durationInFrames?: number; fps?: number; width?: number; height?: number};
const customConfig: CustomConfig = (userModule as {config?: CustomConfig}).config ?? {};

const customMeta: CalculateMetadataFunction<Record<string, unknown>> = ({props}) => {
  const base = dimensions(safeRatio(props.ratio));
  return {
    durationInFrames: Math.round(clamp(customConfig.durationInFrames as number, 1, 1800, 150)),
    fps: clamp(customConfig.fps as number, 1, 60, FPS),
    width: Math.round(clamp(customConfig.width as number, 16, 3840, base.width)),
    height: Math.round(clamp(customConfig.height as number, 16, 3840, base.height)),
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id='KineticTitle'
        component={KineticTitle}
        durationInFrames={150}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={kineticTitleDefaults}
        calculateMetadata={kineticMeta}
      />
      <Composition
        id='TikTokSlides'
        component={TikTokSlides}
        durationInFrames={300}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={tikTokSlidesDefaults}
        calculateMetadata={slidesMeta}
      />
      <Composition
        id='CustomCode'
        component={UserCode as React.ComponentType<Record<string, unknown>>}
        durationInFrames={150}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ratio: '9:16'}}
        calculateMetadata={customMeta}
      />
    </>
  );
};
