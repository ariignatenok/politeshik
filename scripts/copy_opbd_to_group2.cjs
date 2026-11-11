// Generate a one-time, idempotent SQL copy of OPBD teaching materials.
// Run: node scripts/copy_opbd_to_group2.cjs > /tmp/copy-opbd.sql
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const file of ['js/icons.js', 'js/data/cards.js', 'js/data/notes.js'])
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
// Imported starter content uses ordinary IDs, so group/extra sync preserves it.
const seed = vm.runInContext(`({
  cards: SEED_CARDS.filter(x => x.subjectId === 's_opbd').map(x => ({...x, id: 'shared_opbd_' + x.id})),
  notes: SEED_NOTES.filter(x => x.subjectId === 's_opbd').map(x => ({...x, id: 'shared_opbd_' + x.id}))
})`, context);
const json = JSON.stringify(seed);
if (json.includes('$opbd_seed$')) throw Error('SQL delimiter collision');
process.stdout.write("begin;\nselect set_config('app.opbd_seed',$opbd_seed$" + json + "$opbd_seed$,true);\n");
process.stdout.write(fs.readFileSync(path.join(__dirname, 'copy_opbd_to_group2.sql'), 'utf8'));
process.stdout.write('\ncommit;\n');
