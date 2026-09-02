const assert = require('assert');
const { listedExportFields, pickFlowExportData, sanitizeExportName } = require('./flowExport');

function mockExec(bag) {
  const ns = (bag && bag.__ns) || {};
  return {
    readContextField(context, path) {
      const p = String(path || '').trim();
      const prev = (context && context.previous) || bag || {};
      if (p.indexOf('.') >= 0) {
        const i = p.indexOf('.');
        const slug = p.slice(0, i);
        const key = p.slice(i + 1);
        const nested = ns[slug] || (prev.__ns && prev.__ns[slug]) || {};
        if (nested && Object.prototype.hasOwnProperty.call(nested, key)) return nested[key];
      }
      if (Object.prototype.hasOwnProperty.call(prev, p)) return prev[p];
      return undefined;
    }
  };
}

{
  assert.equal(sanitizeExportName('Chrome Page'), 'chrome_page');
  assert.deepEqual(
    listedExportFields({ exportFields: ['ia.html', 'mail.subject', 'ia.html'] }),
    ['ia.html', 'mail.subject']
  );
  assert.deepEqual(
    listedExportFields({ mapping: { html: 'ia.html', css: '__literal__', body: 'mail.body' } }),
    ['ia.html', 'mail.body']
  );
  assert.deepEqual(listedExportFields({ exportFields: [] }), []);
}

{
  const ctx = {
    previous: {
      __ns: {
        ia: { html: '<p>ok</p>', css: 'p{color:red}', response: 'ignore' },
        mail: { subject: 'Devis', body: 'Bonjour' }
      }
    }
  };
  const picked = pickFlowExportData(mockExec(ctx.previous), ctx, {
    exportFields: ['ia.html', 'mail.subject']
  });
  assert.equal(picked.html, '<p>ok</p>');
  assert.equal(picked.fields.subject, 'Devis');
  assert.ok(picked.css === '' || picked.css == null || !picked.fields.css, 'css non coché');
}

{
  const ctx = {
    previous: {
      html: '<div>legacy</div>',
      css: 'div{}'
    }
  };
  const picked = pickFlowExportData(mockExec(ctx.previous), ctx, {});
  assert.equal(picked.html, '<div>legacy</div>');
  assert.equal(picked.css, 'div{}');
  const empty = pickFlowExportData(mockExec(ctx.previous), ctx, { exportFields: [] });
  assert.equal(empty.html, '');
}

console.log('flowExport.test.js ok');
