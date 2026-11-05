import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
for (const name of ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_OWNER_UID']) if (!process.env[name]) throw Error(`Missing required build setting: ${name}`);
for(const folder of [root,join(root,'Dashboard2')]) {
  execFileSync(process.execPath,[join(folder,'node_modules/typescript/bin/tsc'),'--noEmit'],{cwd:folder,stdio:'inherit'});
  execFileSync(process.execPath,[join(folder,'node_modules/vite/bin/vite.js'),'build'],{cwd:folder,stdio:'inherit'});
}
const out=join(root,'cloudflare-dist');
if(out!==resolve(root,'cloudflare-dist')) throw Error('Unexpected output path');
rmSync(out,{recursive:true,force:true});
mkdirSync(join(out,'ects'),{recursive:true});mkdirSync(join(out,'campus'),{recursive:true});
cpSync(join(root,'dist'),join(out,'ects'),{recursive:true});
cpSync(join(root,'Dashboard2/dist'),join(out,'campus'),{recursive:true});
writeFileSync(join(out,'index.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Studienübersicht</title><h1>Studienübersicht</h1><ul><li><a href="ects/">ECTS</a></li><li><a href="campus/">Campus</a></li></ul>');

writeFileSync(join(out,'_headers'), '/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
