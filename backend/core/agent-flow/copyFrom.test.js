const assert = require('assert');
const {
  asCopyObject,
  valueFromCopySource,
  applyCopyFrom,
  copyFromPath,
  copyFieldToken,
  isCopyFieldToken
} = require('./copyFrom');

function mockExec(bag) {
  return {
    readContextField(context, path) {
      const p = String(path || '').trim();
      const prev = (context && context.previous) || bag || {};
      const ns = prev.__ns || {};
      if (p.indexOf('.') >= 0) {
        const i = p.indexOf('.');
        const slug = p.slice(0, i);
        const key = p.slice(i + 1);
        const nested = ns[slug] || {};
        if (key === 'item') return nested.item || nested;
        if (Object.prototype.hasOwnProperty.call(nested, key)) return nested[key];
      }
      if (ns[p]) return ns[p];
      if (Object.prototype.hasOwnProperty.call(prev, p)) return prev[p];
      return undefined;
    }
  };
}

{
  assert.equal(copyFromPath({ copyFrom: 'donnees.item' }), 'donnees.item');
  assert.equal(copyFieldToken('donnees.item', 'to'), '{{donnees.item.to}}');
  assert.equal(isCopyFieldToken('{{donnees.item.to}}', 'donnees.item', 'to'), true);
  assert.equal(isCopyFieldToken('{{donnees.to}}', 'donnees.item', 'to'), true);
  assert.equal(isCopyFieldToken('{{action.to}}', 'donnees.item', 'to'), false);
  assert.equal(isCopyFieldToken('commercial@x.fr', 'donnees.item', 'to'), false);
}

{
  const table = {
    item: { from: 'a@x.fr', subject: 'Devis', text: 'Bonjour', to: 'support@x.fr' },
    items: [{ from: 'a@x.fr', subject: 'Devis', text: 'Bonjour', to: 'support@x.fr' }],
    itemIndex: 0
  };
  const obj = asCopyObject(table);
  assert.equal(obj.subject, 'Devis');
  assert.equal(valueFromCopySource(obj, 'body'), 'Bonjour');
  assert.equal(valueFromCopySource(obj, 'to'), 'support@x.fr');
}

{
  const ctx = {
    previous: {
      __ns: {
        donnees: {
          item: { subject: 'S', text: 'Corps', attachments: [{ filename: 'a.pdf' }], to: 'inbox@x.fr' }
        }
      }
    }
  };
  const picked = applyCopyFrom(mockExec(ctx.previous), { copyFrom: 'donnees.item' }, ctx, {
    to: 'commercial@x.fr'
  });
  assert.equal(picked.to, 'commercial@x.fr');
  assert.equal(picked.subject, 'S');
  assert.equal(picked.body || picked.text, 'Corps');
  assert.equal(picked.attachments[0].filename, 'a.pdf');
}

console.log('copyFrom.test.js ok');
