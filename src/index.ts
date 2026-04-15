import { fileURLToPath } from 'url';

export function helloWorld() {
  return 'Hello World!';
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  console.log(helloWorld());
}
