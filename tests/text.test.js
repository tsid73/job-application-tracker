import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { csvEscape } from '../server/utils/text.js';

test('csvEscape neutralizes spreadsheet formula prefixes', () => {
  assert.equal(csvEscape('=1+1'), "'=1+1");
  assert.equal(csvEscape('+cmd'), "'+cmd");
  assert.equal(csvEscape('-cmd'), "'-cmd");
  assert.equal(csvEscape('@cmd'), "'@cmd");
});

test('csvEscape still quotes CSV-special characters after neutralization', () => {
  assert.equal(csvEscape('=cmd,"payload"'), `"\'=cmd,""payload"""`);
  assert.equal(csvEscape('plain,value'), '"plain,value"');
});

test('sidebar menu does not expose kanban navigation', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const uncommentedHtml = html.replaceAll(/<!--[\s\S]*?-->/g, '');

  assert.equal(uncommentedHtml.includes('data-view="kanban"'), false);
});
