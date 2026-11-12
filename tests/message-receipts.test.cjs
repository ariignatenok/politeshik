const {test} = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
function app() {
  const ctx = vm.createContext({console});
  vm.runInContext(
    `const Cloud={uid:'student',status:'online',hasCabinet:()=>true,isAdmin:false,isDeveloper:false};
 const document={hidden:false};const App={renders:0,renderSoft(){this.renders++}};let rows=[];
 const q={select(){return this},eq(){return this},order(){return this},limit(){return this},then(done){return Promise.resolve({data:rows,error:null}).then(done)}};
 const supa={from:()=>q};`,
    ctx,
  );
  vm.runInContext(fs.readFileSync('js/dm.js', 'utf8'), ctx);
  vm.runInContext('globalThis.api={Dm,App,Cloud,messageReceipt,setRows:r=>rows=r};', ctx);
  return ctx.api;
}
test('one tick denotes an unread message and two ticks require an actual read flag', () => {
  const {messageReceipt} = app();
  assert.ok(messageReceipt(false).includes('>✓<'));
  assert.ok(!messageReceipt(false).includes('✓✓'));
  assert.ok(messageReceipt(true).includes('✓✓'));
  assert.ok(messageReceipt(true).includes('aria-label="Прочитано"'));
  assert.ok(messageReceipt(true, true).includes('Политешик ответил'));
});
test('both sender and recipient read flag changes refresh support chat receipts', async () => {
  const a = app(),
    m = {
      id: 1,
      thread_uid: 'student',
      sender: 'student',
      body: 'Привет',
      read_by_student: false,
      read_by_admin: false,
      recipient_role: 'superadmin',
    };
  a.setRows([{...m}]);
  await a.Dm.refresh();
  const first = a.App.renders;
  a.setRows([{...m, read_by_admin: true}]);
  await a.Dm.refresh();
  assert.equal(a.App.renders, first + 1, 'Student sender did not see staff read receipt');
  a.Cloud.uid = 'staff';
  a.Cloud.isAdmin = true;
  a.setRows([{...m, sender: 'staff'}]);
  await a.Dm.refresh();
  const second = a.App.renders;
  a.setRows([{...m, sender: 'staff', read_by_student: true}]);
  await a.Dm.refresh();
  assert.equal(a.App.renders, second + 1, 'Staff sender did not see student read receipt');
});
