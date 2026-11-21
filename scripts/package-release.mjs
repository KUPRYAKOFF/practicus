import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(await readFile('package.json','utf8'));
if(!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))throw new Error('Invalid release version');
execFileSync('python3',['-c',String.raw`
import pathlib,zipfile,sys
version=sys.argv[1]
for folder,label in [('apps-script','apps-script'),('site','web')]:
 root=pathlib.Path('dist')/folder
 with zipfile.ZipFile(pathlib.Path('dist')/('practicus-'+label+'-v'+version+'.zip'),'w',zipfile.ZIP_DEFLATED) as z:
  for path in sorted(root.rglob('*')):
   if path.is_file() and not path.name.startswith('.'): z.write(path,path.relative_to(root))
`,version]);
const names=['practicus-apps-script-v'+version+'.zip','practicus-web-v'+version+'.zip','release-manifest.json'];
await writeFile('dist/SHA256SUMS.txt',(await Promise.all(names.map(async name=>createHash('sha256').update(await readFile('dist/'+name)).digest('hex')+'  '+name))).join('\n')+'\n');
console.log('Release packages and SHA256SUMS written to dist/');
