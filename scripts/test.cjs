'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['work/highres-qa/verify-bundle.cjs','work/qa-label-placement.cjs','work/qa-backgrounds.cjs','work/highres-qa/verify.cjs']){
 console.log('\nRunning '+file);
 const result=spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit'});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
