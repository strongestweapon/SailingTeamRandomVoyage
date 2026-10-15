const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('outputs/Random-Voyage-Map-Studio.html','utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,5);const files=['data.js','backgrounds.js','renderer.js','highres.js','app.js'];
for(let i=0;i<files.length;i++){assert.equal(scripts[i],fs.readFileSync('work/route-studio/dist/'+files[i],'utf8').replaceAll('</script','<\\/script'));new vm.Script(scripts[i],{filename:files[i]});}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]); // Limit uniqueness check to actual markup, not renderer templates.
const markup=html.slice(0,html.indexOf('<script>')),controls=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(controls).size,controls.length);
assert(markup.includes('고해상도 위성 · 온라인'));assert(markup.includes('지도 배경 · 4가지 뷰'));assert(!html.includes('20240627.ADM'));
console.log('PASS: standalone bundle matches all five checked sources; no duplicate controls; HD option present; excluded GPX remains absent.');
