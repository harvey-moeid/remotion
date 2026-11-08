import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {FPS, dimensions} from './lib/ratio';
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

// Dimensi dan durasi dihitung dari props (ratio, durationSeconds, jumlah slide).
const kineticMeta: CalculateMetadataFunction<KineticTitleProps> = ({props}) => {
  const p = normalizeKinetic(props);
  return {durationInFrames: Math.round(p.durationSeconds * FPS), ...dimensions(p.ratio)};
};

const slidesMeta: CalculateMetadataFunction<TikTokSlidesProps> = ({props}) => {
  const p = normalizeSlides(props);
  return {durationInFrames: p.slides.length * framesPerSlide(p), ...dimensions(p.ratio)};
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
    </>
  );
};
