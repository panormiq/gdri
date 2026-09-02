const assert = require('assert');
const {
  applyFlowConsume,
  projectPrevious,
  neededPathsForNodes,
  KEEP_ALL
} = require('./flowConsume');
const { descendantBranchNodes, remainingConsumerNodes } = require('./flowGraph');

function nsPrev(mail, extra) {
  return {
    subject: mail.subject,
    body: mail.body,
    __ns: { mail: { ...mail } },
    __nsOrder: ['mail'],
    ...(extra || {})
  };
}

const mailNode = {
  id: 'm1',
  slug: 'mail',
  brickId: 'data',
  config: {}
};
const actionA = {
  id: 'a1',
  slug: 'action',
  brickId: 'action',
  config: {
    mapping: { html: 'mail.subject' },
    values: { corps: '{{mail.body}}' }
  }
};
const actionB = {
  id: 'a2',
  slug: 'actionb',
  brickId: 'action',
  config: { mapping: { html: 'mail.subject' } }
};
const unusedWriter = {
  id: 'w1',
  slug: 'ia',
  brickId: 'ia',
  config: { prompt: 'hello' }
};

{
  const afterMail = applyFlowConsume(nsPrev({ subject: 'S', body: 'B' }), { type: 'mail' }, mailNode, {}, [actionA]);
  assert.equal(afterMail.__ns.mail.subject, 'S');
  assert.equal(afterMail.__ns.mail.body, 'B', 'première lecture plus loin : body encore là');
}

{
  const afterA = applyFlowConsume(
    nsPrev({ subject: 'S', body: 'B' }),
    { html: '<p>x</p>' },
    actionA,
    { html: '<p>x</p>' },
    []
  );
  assert.ok(!afterA.__ns.mail || afterA.__ns.mail.subject == null, 'dernière conso : subject parti');
  assert.ok(!afterA.__ns.mail || afterA.__ns.mail.body == null, 'dernière conso : body parti');
}

{
  const afterUnused = applyFlowConsume(
    nsPrev({ subject: 'S', body: 'B' }),
    { intention: 'devis' },
    unusedWriter,
    { intention: 'devis' },
    [actionB]
  );
  assert.equal(afterUnused.__ns.mail.subject, 'S');
  assert.equal(afterUnused.__ns.mail.body, undefined, 'plus aucun lecteur de body');
  assert.ok(!afterUnused.intention && !(afterUnused.__ns.ia && afterUnused.__ns.ia.intention), 'écriture jamais lue : jetée');
}

{
  const prev = {
    foo: 1,
    bar: 2,
    __ns: { mail: { foo: 1, bar: 2 }, ia: { foo: 9 } },
    __nsOrder: ['mail', 'ia']
  };
  const projected = projectPrevious(prev, ['mail.foo']);
  assert.equal(projected.__ns.mail.foo, 1);
  assert.equal(projected.__ns.mail.bar, undefined);
  assert.equal(projected.__ns.ia, undefined);
}

{
  const nodes = [
    { id: 'split', nextIds: ['b', 'c'] },
    { id: 'b', nextIds: ['join'], config: { mapping: { x: 'mail.subject' } }, brickId: 'action' },
    { id: 'c', nextIds: ['join'], config: { mapping: { y: 'mail.body' } }, brickId: 'action' },
    { id: 'join', nextIds: [] }
  ];
  const branchB = descendantBranchNodes('b', nodes);
  const needed = neededPathsForNodes(branchB);
  assert.ok(needed.indexOf('mail.subject') >= 0);
  assert.ok(needed.indexOf('mail.body') < 0, 'branche B n’injecte pas body');
}

{
  const nodes = [
    { id: 'a', nextIds: ['b'] },
    { id: 'b', nextIds: ['c'] },
    { id: 'c', nextIds: [] }
  ];
  const rem = remainingConsumerNodes(nodes, [], ['b'], { a: true }, 'a');
  assert.deepEqual(rem.map((n) => n.id), ['b', 'c']);
}

{
  const sub = { brickId: 'validation', config: { subTemplateId: 'agent-design-page-web' } };
  assert.strictEqual(neededPathsForNodes([sub]), KEEP_ALL);
}

{
  const out = {
    brickId: 'output',
    config: { provider: 'flow', exportFields: ['ia.html', 'mail.subject'] }
  };
  const needed = neededPathsForNodes([out]);
  assert.ok(needed.indexOf('ia.html') >= 0);
  assert.ok(needed.indexOf('mail.subject') >= 0);
}

{
  const act = {
    brickId: 'action',
    config: { copyFrom: 'donnees.item', values: { to: 'commercial@x.fr' } }
  };
  const needed = neededPathsForNodes([act]);
  assert.ok(needed.indexOf('donnees.item') >= 0);
}

{
  const kept = applyFlowConsume({ secret: 1, __ns: {}, __nsOrder: [] }, {}, mailNode, {}, undefined);
  assert.equal(kept.secret, 1, 'sans remainingNodes : on ne touche pas');
}

console.log('flowConsume ok');
