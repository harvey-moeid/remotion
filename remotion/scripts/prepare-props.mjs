import {writeFileSync} from 'node:fs';

// Menggabungkan props dari workflow_dispatch dengan rasio menjadi props.json untuk `remotion render`.
let props = {};
try {
  props = JSON.parse(process.env.PROPS_JSON || '{}');
} catch (error) {
  console.error('props bukan JSON valid:', error.message);
  process.exit(1);
}

if (props === null || typeof props !== 'object' || Array.isArray(props)) {
  console.error('props harus berupa object JSON');
  process.exit(1);
}

props.ratio = process.env.RATIO === '16:9' ? '16:9' : '9:16';
writeFileSync('props.json', JSON.stringify(props));
console.log('props.json ditulis. Kunci:', Object.keys(props).join(', '));
