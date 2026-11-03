// Accounting checks for program 2 (new/) on a fake phone storage: the user's real November case + the rules in the brief.
const {chromium}=require('playwright');const path=require('path');
const FILE='file://'+path.resolve(__dirname,'..',process.argv[2]||'new/index.html');
const KEY=(process.argv[2]||'new/index.html').startsWith('new')?'modo2.db.v1':'modo.db.v1';
const docs={'cfg/main':{name:'مودو برجر',shares:[{from:'2026-10-18',parts:[{name:'انس',pct:100}]},{from:'2026-11-02',parts:[{name:'انس',pct:75},{name:'عبدالوهاب',pct:25}]}],partners:[],apps:[{name:'طلباتي',fee:25}],cashiers:['كاشير 1'],emps:[{name:'علي',pay:'شهري',hist:[{from:'2026-10-01',salary:300000}]}]},
 'tx/a':{d:'2026-11-01',k:'in',amt:62000,src:'كاش',cashier:'كاشير 1',fee:0,ts:1},
 'tx/b':{d:'2026-11-01',k:'partner',who:'انس',dir:'عليه',amt:25000,ts:2},          // old record: no source flag
 'tx/c':{d:'2026-11-01',k:'emp',who:'علي',sub:'سحب',amt:8000,ts:3}};
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(([k,d])=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,JSON.stringify({docs:d}));localStorage.setItem('modo2.view','month');localStorage.setItem('modo.view','month');sessionStorage.setItem('seeded','1')}},[KEY,docs]);
 await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
 await p.clock.install({time:new Date('2026-11-03T12:00:00')});
 await p.goto(FILE);await p.waitForTimeout(400);
 const num=async s=>+((await p.textContent(s)).replace(/[^\d-]/g,''));
 // 1) old record keeps old numbers (taken from the drawer before counting = unrecorded sale)
 ok(await num('#netProfit')===79000,'old record unchanged: profit 79,000 (62,000 + 25,000 taken before counting − 8,000)');
 // 2) user flips it to "from recorded money": profit 54,000, partner keeps 54,000 share − 25,000
 await p.click('[data-view=add]');await p.fill('#fDate','2026-11-01');await p.dispatchEvent('#fDate','change');await p.waitForTimeout(200);
 await p.click('[data-pre=b]');await p.waitForTimeout(200);
 await p.click('[data-view=month]');await p.waitForTimeout(200);
 ok(await num('#netProfit')===54000,'flip to recorded money: profit 54,000 — a partner withdrawal does not change profit');
 const part=await p.textContent('#partBox');ok(/54,000/.test(part)&&/29,000/.test(part),'partner انس: share 54,000 − took 25,000 = 29,000');
 // 3) new withdrawal must say where it came from; double tap saves once
 await p.click('[data-view=add]');await p.click('[data-type=partner]');
 for(const k of ['2','0','0','0','0'])await p.click(`[data-key="${k}"]`);
 await p.click('[data-key=SAVE]');ok(/منين|اختار/.test(await p.textContent('#toast')),'asks: from drawer or recorded money');
 await p.click('[data-v="من فلوس محسوبة"]');await p.click('[data-key=C]');for(const k of ['2','0','0','0','0'])await p.click(`[data-key="${k}"]`);
 await p.click('[data-key=SAVE]');await p.click('[data-key=SAVE]');await p.waitForTimeout(200);
 const st=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).docs,KEY);
 const pt=Object.values(st).filter(v=>v.k==='partner');ok(pt.length===2&&pt.some(v=>v.pre===false&&v.amt===20000),'new withdrawal saved once with source');
 // second save of the same amount is blocked within seconds
 await p.click('[data-key=C]');for(const k of ['2','0','0','0','0'])await p.click(`[data-key="${k}"]`);await p.click('[data-v="من فلوس محسوبة"]');await p.click('[data-key=SAVE]');await p.waitForTimeout(150);
 ok(Object.values(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).docs,KEY)).filter(v=>v.k==='partner').length===2,'identical re-save within seconds blocked');
 await p.click('[data-view=month]');await p.waitForTimeout(200);
 ok(await num('#netProfit')===54000,'brief example: profit stays the same after a 20,000 withdrawal');
 // 4) cancel keeps the record, excluded from totals, can be restored
 await p.click('[data-view=add]');await p.waitForTimeout(150);
 await p.click('[data-del=c]');await p.click('[data-del=c]');await p.waitForTimeout(200);
 const c=(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).docs['tx/c'],KEY));ok(c&&c.void===true,'cancelled record kept (not deleted)');
 await p.click('[data-view=month]');await p.waitForTimeout(150);ok(await num('#netProfit')===62000,'cancelled worker draw excluded: profit 62,000');
 await p.click('[data-view=add]');await p.waitForTimeout(150);await p.click('[data-undo=c]');await p.waitForTimeout(150);
 await p.click('[data-view=month]');await p.waitForTimeout(150);ok(await num('#netProfit')===54000,'restored: profit 54,000 again');
 // 5) day table total = month profit
 const tbl=await p.$$eval('#daysTbl tr td:last-child b',x=>x.map(e=>+e.textContent.replace(/[^\d-]/g,'')));ok(tbl.reduce((a,b)=>a+b,0)===54000,'days table sums to the month profit');
 // 6) backup warning when never backed up
 ok(await p.isVisible('#bkWarn'),'backup reminder shown');
 await p.screenshot({path:process.env.SHOT||'/tmp/mm.png',fullPage:true});
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();process.exit(fails?1:0)})();
