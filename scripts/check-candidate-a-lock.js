import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('development-history/checkpoints/candidate-a-visual-approved.json'));
for(const [path,expected]of Object.entries(manifest.files)){const actual=createHash('sha256').update(await readFile(path)).digest('hex');if(actual!==expected)throw Error('Approved Candidate A asset changed: '+path);}
console.log(`Candidate A visual lock intact: ${Object.keys(manifest.files).length} source/assets match the approved inventory.`);
