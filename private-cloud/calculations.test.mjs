import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {makeModule}=await vite.ssrLoadModule('/src/model.ts');
 const {calculate}=await vite.ssrLoadModule('/src/calculations.ts');
 const a=makeModule('Advanced Topics on Synthetic Subject',5,'core','Bestanden',{grade:'1.0',credit:'Bestätigt'});
 const alias=makeModule('Advanced Topics of Synthetic Subject',5,'core','Bestanden',{grade:'1.0',credit:'Bestätigt'});
 assert.equal(calculate([a,alias]).earned,5);
 const b=makeModule('Other synthetic subject',10,'ie','Bestanden',{grade:'2.0',credit:'Bestätigt'});
 assert.equal(calculate([a,b]).earned,15);
 const generic=makeModule('Masterseminar',5,'seminar','Bestanden',{credit:'Bestätigt'});
 const named=makeModule('Master Seminar Synthetic Subject',5,'seminar','Bestanden',{credit:'Bestätigt'});
 assert.equal(calculate([generic,named]).earned,5);
 const specs=[[5,'core'],[5,'core'],[5,'ie'],[6,'ie'],[5,'ie'],[5,'ie'],[6,'management'],[6,'management'],[3,'ethics'],[3,'general'],[3,'general']];
 const workload=specs.map(([ects,area],i)=>makeModule('Synthetic '+i,ects,area,'Geplant',{credit:i===7?'Prüfung ausstehend':'Bestätigt',planStatus:'Verbindlich',provider:i>=9?'VHB':'TUM'}));
 const {semesterStats}=await vite.ssrLoadModule('/src/calculations.ts');
 assert.equal(semesterStats(workload,0).workload,52);assert.equal(semesterStats(workload,0).registered,46);assert.equal(calculate(workload).earned,0);
 console.log('ECTS calculation and duplicate-name normalization passed.');
} finally {await vite.close()}
