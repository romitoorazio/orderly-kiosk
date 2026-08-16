import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/pages/CustomerTotem.tsx';
let source = readFileSync(path, 'utf8');

const call = '      playOrderNumber({ ...orderData, id: realId });\n';
if (source.includes(call)) {
  console.log('[audio] cash announcement already integrated');
  process.exit(0);
}

if (!source.includes('const playOrderNumber = useCallback')) {
  throw new Error('[audio] static order-number player is missing; refusing to patch build');
}

const anchor = '      setOrderComplete({ ...orderData, id: realId });\n      setCart([]);\n';
if (!source.includes(anchor)) {
  throw new Error('[audio] cash completion anchor changed; refusing to build rather than risk the kiosk');
}

source = source.replace(
  anchor,
  '      setOrderComplete({ ...orderData, id: realId });\n' + call + '      setCart([]);\n',
);

writeFileSync(path, source, 'utf8');
console.log('[audio] cash order announcement integrated safely');
