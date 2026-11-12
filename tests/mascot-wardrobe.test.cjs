const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app() {
  const ctx = vm.createContext({setTimeout, clearTimeout, console});
  vm.runInContext(
    `const Store={s:{settings:{mascot:{}},meta:{}},save(){}};
 const Cloud={uid:'owner',tenantId:'group_2',status:'online',profile:{},hasCabinet:()=>true};
 const document={addEventListener(){},getElementById(){return null}};
 const window={}; const U={esc:s=>String(s),initials:()=> 'AB'};
 const supa={rpc:async()=>({data:true})}; const App={renderSoft(){}};
 function avatarOf(v,size){return '<img data-photo="'+v+'" width="'+size+'">'};
 `,
    ctx,
  );
  for (const file of ['js/mascot.js', 'js/mascot-wardrobe.js', 'js/mascot-fashion.js', 'js/avatars.js'])
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  vm.runInContext('globalThis.api={Wardrobe,Mascot,Avatars,Store,Cloud,supa};', ctx);
  return ctx.api;
}
test('foreign mascot rendering is independent of the viewing user and sanitizes untrusted catalogue IDs', () => {
  const {Mascot, Store, Avatars, Wardrobe} = app();
  Store.s.settings.mascot = {body: 'pink', hair: 'emo', outfit: 'leopard', hand: 'coffee'};
  Avatars.looks.peer = {body: 'blue', hair: 'bun', outfit: 'fur', hand: 'tea'};
  const svg = Avatars.html('peer', 50);
  assert.ok(svg.includes('#8fcafa'));
  assert.ok(!svg.includes('#f6a6ce'));
  assert.ok(Avatars.html('unknown', 50).includes('#8be0a4'));
  const safe = Wardrobe.normalize({body: '<script>', hair: 'url(x)', acc: ['hat', 'hat', '<img>']});
  assert.equal(safe.body, 'green');
  assert.equal(safe.hair, 'none');
  assert.deepEqual(Array.from(safe.acc), ['hat']);
  for (const {look} of Object.values(Wardrobe.presets))
    assert.ok(Mascot.svg('happy', 120, '', {look, season: ''}).endsWith('</svg>'));
});
test('accessory and mood changes preserve clothing and body; photos remain beside the mascot', () => {
  const {Mascot, Store, Avatars} = app();
  Store.s.settings.mascot = {body: 'blue', outfit: 'leopard', hair: 'waves', hand: 'coffee'};
  Mascot.setAccessory('bow');
  Mascot.chooseMood('angry');
  assert.equal(Store.s.settings.mascot.body, 'blue');
  assert.equal(Store.s.settings.mascot.outfit, 'leopard');
  assert.equal(Store.s.settings.mascot.hand, 'coffee');
  Avatars.map.peer = 'm4';
  Avatars.looks.peer = {body: 'pink'};
  const html = Avatars.small('peer', 'Peer', 24);
  assert.ok(html.includes('data-photo="m4"'));
  assert.ok(html.includes('#f6a6ce'));
});
test('rapid changes are serialized, retry preserves local appearance, and profile sync respects pending edits', async () => {
  const {Wardrobe, Mascot, Store, Cloud, supa} = app();
  let release;
  const calls = [];
  supa.rpc = (name, args) => {
    calls.push(args.p_look);
    return calls.length === 1 ? new Promise((resolve) => (release = resolve)) : Promise.resolve({});
  };
  Store.s.settings.mascot = Wardrobe.normalize({body: 'pink'});
  Store.s.meta.mascotPending = true;
  const first = Wardrobe.save();
  Store.s.settings.mascot.body = 'blue';
  Cloud.profile.mascot = {body: 'green'};
  Mascot.syncFromProfile();
  assert.equal(Store.s.settings.mascot.body, 'blue');
  release({});
  await first;
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(
    calls.map((x) => x.body),
    ['pink', 'blue'],
  );
  assert.equal(Store.s.meta.mascotPending, false);
  supa.rpc = async () => ({error: {message: 'offline'}});
  Store.s.meta.mascotPending = true;
  await Wardrobe.save();
  assert.equal(Store.s.meta.mascotPending, true);
  supa.rpc = async () => ({});
  await Wardrobe.save();
  assert.equal(Store.s.meta.mascotPending, false);
});

test('reference pieces stay independent and legacy looks get empty new slots', () => {
  const {Wardrobe, Mascot, Store} = app();
  Store.s.settings.mascot = Wardrobe.normalize({
    body: 'pink',
    outfit: 'leopard',
    top: 'whitesweater',
    chain: 'doublegold',
    hat: 'purplewitch',
    shoes: 'chunkysneakers',
    bag: 'monogram',
    glasses: 'pinkheart',
    hand: 'coffee',
  });
  Wardrobe.set('chain', 'shortgold');
  assert.equal(Mascot.chosen().top, 'whitesweater');
  assert.equal(Mascot.chosen().outfit, 'leopard');
  Wardrobe.set('top', 'blacktee');
  assert.equal(Mascot.chosen().chain, 'shortgold');
  assert.equal(Mascot.chosen().bag, 'monogram');
  Wardrobe.set('chain', 'none');
  assert.equal(Mascot.chosen().top, 'blacktee');
  const layers = Wardrobe.layers(Mascot.chosen());
  assert.ok(layers.clothes.includes('data-item="blacktee"'));
  assert.ok(layers.clothes.includes('data-item="leopard"'));
  assert.ok(!layers.clothes.includes('data-item="shortgold"'));
  assert.ok(layers.front.includes('data-item="chunkysneakers"'));
  assert.ok(layers.front.includes('data-item="monogram"'));
  assert.ok(layers.hat.includes('data-item="purplewitch"'));
  assert.ok(layers.face.includes('data-item="pinkheart"'));
  const old = Wardrobe.normalize({body: 'blue', acc: ['bow']});
  assert.equal(old.top, 'none');
  assert.equal(old.chain, 'none');
  assert.equal(old.body, 'blue');
  Wardrobe.set('outfit', 'hoodie');
  assert.equal(Mascot.chosen().top, 'none');
  Wardrobe.set('top', 'whitesweater');
  assert.equal(Mascot.chosen().outfit, 'none');
});

test('wardrobe opens only on Edit and vampire traits combine with glasses', () => {
  const {Mascot, Wardrobe} = app();
  assert.ok(Mascot.cardHtml().includes('data-action="mascot-edit"'));
  assert.ok(!Mascot.cardHtml().includes('data-action="mascot-part"'));
  Wardrobe.editing = true;
  assert.ok(Mascot.cardHtml().includes('data-action="mascot-done"'));
  assert.ok(Mascot.cardHtml().includes('data-action="mascot-part"'));
  const boy = Wardrobe.presets.vampireboy.look,
    girl = Wardrobe.presets.vampiregirl.look;
  assert.notEqual(boy.hair, girl.hair);
  const layers = Wardrobe.layers({...girl, glasses: 'pinkheart'});
  assert.ok(layers.face.includes('data-item="vampire"'));
  assert.ok(layers.face.includes('data-item="pinkheart"'));
  for (const {look} of Object.values(Wardrobe.presets))
    assert.ok(!Mascot.svg('happy', 120, '', {look, season: ''}).includes('undefined'));
});

test('mascot nickname survives presets and appearance reset; body is circular', () => {
  const {Mascot, Wardrobe, Store} = app();
  Store.s.settings.mascot = Wardrobe.normalize({nickname: 'Fluffy Плюш', body: 'pink'});
  assert.equal(Mascot.chosen().nickname, 'Fluffy Плюш');
  Wardrobe.preset('vampiregirl');
  assert.equal(Mascot.chosen().nickname, 'Fluffy Плюш');
  Mascot.resetLook();
  assert.equal(Mascot.chosen().nickname, 'Fluffy Плюш');
  assert.equal(Wardrobe.normalize({nickname: 'Кекс\nКот'}).nickname, 'КексКот');
  const svg = Mascot.svg('happy', 120, '', {season: '', look: {}});
  assert.ok(svg.includes('data-mascot-body="round"'));
  assert.ok(svg.includes('cx="60" cy="72" r="38"'));
});
