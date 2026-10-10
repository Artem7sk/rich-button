(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PF=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const MAX=99999999999, CURRENCIES=['USD','EUR','GBP','KZT','RUB'];
const clone=x=>JSON.parse(JSON.stringify(x));
function dateOK(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function amount(s){s=String(s).trim().replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('amount');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>MAX)throw Error('amount');return n;}
function lineTotal(l){if(!Number.isSafeInteger(l.qty)||l.qty<1||l.qty>100000||!Number.isSafeInteger(l.unit)||l.unit<=0||l.unit>MAX||l.qty*l.unit>MAX)throw Error('line');return l.qty*l.unit;}
const total=i=>i.items.reduce((s,l)=>s+lineTotal(l),0),paid=i=>i.payments.reduce((s,p)=>s+p.amount,0),balance=i=>total(i)-paid(i);
function status(i,now=today()){return i.cancelled?'cancelled':balance(i)===0?'paid':i.due<now?'overdue':paid(i)>0?'partial':'pending';}
function money(n,c,lang='ru'){return new Intl.NumberFormat(lang==='ru'?'ru-RU':'en-US',{style:'currency',currency:c,minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100);}
function parseOcrMoney(value){
 let s=String(value??'').replace(/[^\d.,]/g,'');if(!s||!/^\d[\d.,]*$/.test(s))return null;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.'),decimal=Math.max(comma,dot);
 if(comma>=0&&dot>=0){const sep=decimal===comma?',':'.';s=s.replace(/[.,]/g,'');s=s.slice(0,-2)+'.'+s.slice(-2);}
 else if(decimal>=0){const places=s.length-decimal-1;if(places===1||places===2)s=s.slice(0,decimal)+'.'+s.slice(decimal+1);else s=s.replace(/[.,]/g,'');}
 const n=Number(s);if(!Number.isFinite(n)||n<=0||n>MAX/100)return null;return Math.round(n*100);
}
function ocrLines(raw){return String(raw??'').normalize('NFKC').replace(/[\u00a0\u202f]/g,' ').split(/\n+/).map(x=>x.replace(/[\t\r]+/g,' ').trim().replace(/\s{2,}/g,' ')).filter(Boolean);}
function labeledValue(lines,pattern,stop){for(let n=0;n<lines.length;n++){const m=lines[n].match(pattern);if(!m)continue;const same=(m[1]||'').trim().replace(/^[\s:;=—-]+/,'');if(same)return stop?same.split(stop)[0].trim():same;const next=lines[n+1]||'';if(next&&!/^(?:бин|иин|инн|кпп|огрн|бик|кбе|и\s*и\s*к|iban|тел\.?|телефон|email|e-?mail)(?=[\s:№-]|$)/i.test(next))return next.trim();}return '';}
function parseInvoiceText(raw){
 const lines=ocrLines(raw),textValue=lines.join('\n');
 const dueValue=labeledValue(lines,/(?:срок\s+(?:оплаты|платежа)|оплатить\s+до|дата\s+оплаты|due\s+date)\s*[:№-]?\s*(.*)$/iu);
 let clientName=labeledValue(lines,/(?:покупатель|заказчик|контрагент|клиент|bill\s+to|customer)\s*[:№-]?\s*(.*)$/iu,/\s+(?=(?:БИН|ИИН|ИНН|КПП|ОГРН|тел\.?|телефон|e-?mail)(?:\s|$))/iu);
 clientName=clientName.replace(/[;,]+$/,'').slice(0,150);
 const parseDate=value=>{let m=String(value).match(/(?<!\d)(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)/);let y,mo,d;if(m){[,y,mo,d]=m;}else{m=String(value).match(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/);if(!m)return null;[,d,mo,y]=m;}const result=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return dateOK(result)?result:null;};
 const currencyOf=value=>{if(/(?:\bRUB\b|₽|руб(?:\.|лей|ля|ль)?)/iu.test(value))return 'RUB';if(/(?:\bUSD\b|\$)/i.test(value))return 'USD';if(/(?:\bEUR\b|€)/i.test(value))return 'EUR';if(/(?:\bGBP\b|£)/i.test(value))return 'GBP';if(/\bKZT\b|₸|тенге|тг\.?/iu.test(value))return 'KZT';return null;};
 const currency=lines.map(line=>({line,currency:currencyOf(line)})).find(x=>x.currency&&/(?:итого|всего|к оплате|total|amount due|сумма к оплате)/i.test(x.line))?.currency||lines.map(currencyOf).find(Boolean)||currencyOf(textValue);
 const ignored=/^(?:итого|всего|к оплате|сумма|ндс|налог|количество|кол-?во|наименование|цена|стоимость|срок|покупатель|заказчик|получатель|контрагент|клиент|бин|иин|инн|кпп|огрн|бик|кбе|банк|item|description|qty|quantity|price|amount)(?=[\s:№-]|$)/i;
 const cleanMoneyText=value=>String(value).replace(/(?:₽|руб(?:\.|лей|ля|ль)?|тенге|тг\.?|RUB|USD|EUR|GBP|KZT|[$€£₸])/giu,'').trim();
 const parseMoney=value=>parseOcrMoney(String(value).replace(/[\s\u00a0\u202f]/g,''));
 const amountToken='(?:\\d{1,3}(?:[ \\t.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
 const items=[];
 for(const source of lines){
  let line=cleanMoneyText(source);if(ignored.test(line))continue;
  line=line.replace(/^(?:№\s*)?\d{1,4}[.)]?\s+(?=\D)/,'').trim();
  const row=new RegExp(`^(.{2,}?)\\s+(\\d{1,6})(?:[.,]0+)?\\s*(?:шт\\.?|ед\\.?|усл\\.?|час(?:а|ов)?|ч\\.?|pcs?\\.?|units?)?\\s+([\\d., ]+)\\s*$`,'iu').exec(line);if(!row)continue;
  const name=row[1].trim(),qty=Number(row[2]),rest=row[3].trim();let unit=null;
  const candidates=[];for(const gap of rest.matchAll(/\s+/g)){const left=rest.slice(0,gap.index).trim(),right=rest.slice(gap.index+gap[0].length).trim();if(!new RegExp(`^${amountToken}$`,'u').test(left)||!new RegExp(`^${amountToken}$`,'u').test(right))continue;const price=parseMoney(left),sum=parseMoney(right);if(!price||!sum||price*qty>MAX)continue;const difference=Math.abs(price*qty-sum),score=difference===0?0:difference/Math.max(price*qty,sum);candidates.push({price,score,exact:difference===0});}
  if(candidates.length){candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||a.score-b.score);unit=candidates[0].price;}
  else unit=parseMoney(rest);
  if(!name||name.length>300||!Number.isSafeInteger(qty)||qty<1||qty>100000||!unit||qty*unit>MAX)continue;
  items.push({name,qty,unit});if(items.length>=100)break;
 }
 let declaredTotal=null;
 for(let n=0;n<lines.length;n++){const line=cleanMoneyText(lines[n]);const match=line.match(/^(?:итого(?:\s+к\s+оплате)?|всего(?:\s+к\s+оплате)?|сумма\s+к\s+оплате|к\s+оплате|total|amount\s+due)\s*[:=]?\s*([\d., ]*)\s*$/iu);if(match){declaredTotal=parseMoney(match[1]);if(!declaredTotal&&lines[n+1])declaredTotal=parseMoney(cleanMoneyText(lines[n+1]));if(declaredTotal)break;}}
 let total=null;const totalOnly=!items.length&&!!declaredTotal;
 if(items.length){const sum=items.reduce((n,item)=>n+item.qty*item.unit,0);if(Number.isSafeInteger(sum)&&sum<=MAX)total=sum;}
 else if(declaredTotal){total=declaredTotal;items.push({name:'Услуги по счёту',qty:1,unit:declaredTotal});}
 const buyerStart=lines.findIndex(line=>/^(?:покупатель|заказчик|контрагент|клиент|bill\s+to|customer)(?=[\s:№-]|$)/iu.test(line));
 let clientDetails={};if(buyerStart>=0){const buyerLines=[];for(let n=buyerStart;n<lines.length;n++){if(n>buyerStart&&/^(?:поставщик|продавец|получатель|основание|наименование|товары|услуги|№|итого|всего|supplier|seller|items|description|total)(?=[\s:№-]|$)/iu.test(lines[n]))break;if(n>buyerStart&&/^\d+[.)]?\s/.test(lines[n]))break;buyerLines.push(lines[n]);}clientDetails=parseClientRequisitesText(buyerLines.join('\n'));clientDetails.name=clientName;}
 return {clientName,clientDetails,due:parseDate(dueValue),currency,items,total,declaredTotal,totalOnly};
}
function parseClientRequisitesText(raw){
 const lines=ocrLines(raw),all=lines.join('\n');
 const value=(pattern,stop)=>labeledValue(lines,pattern,stop).replace(/[;,]+$/,'').trim();
 const binRaw=value(/(?:БИН\s*[\/-]\s*ИИН|ИИН\s*[\/-]\s*БИН|БИН|ИИН|BIN\s*[\/-]\s*IIN|IIN\s*[\/-]\s*BIN|BIN|IIN|ИНН)\s*[:№-]?\s*(.*)$/iu);
 let binIin=(binRaw.match(/(?:\d[\s-]*){10,14}/)||[])[0]||'';binIin=binIin.replace(/\D/g,'');if(![10,12].includes(binIin.length))binIin='';
 const accountRaw=value(/(?:ИИК|И\s*И\s*К|IBAN|Р\/?С(?:Ч)?|РАСЧ[ЕЁ]ТНЫЙ\s+СЧ[ЕЁ]Т|ТЕКУЩИЙ\s+СЧ[ЕЁ]Т|BANK\s+ACCOUNT|ACCOUNT\s+NUMBER)\s*[:№-]?\s*(.*)$/iu);
 const account=(accountRaw.match(/\bKZ(?:[\s-]*[A-Z0-9]){18,24}\b/i)||accountRaw.match(/(?:\d[\d\s-]{9,32}\d)/)||[])[0]?.replace(/[\s-]/g,'').toUpperCase()||'';
 const bic=value(/(?:БИК(?:\s+БАНКА)?|SWIFT(?:\s*\/?\s*BIC)?|BIC(?:\s*\/?\s*SWIFT)?)\s*[:№-]?\s*(.*)$/iu).replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,32);
 const kbeRaw=value(/(?:КБЕ|KBE)\s*[:№-]?\s*(.*)$/iu),kbe=(kbeRaw.match(/\b\d{2}\b/)||[])[0]||'';
 let name=value(/(?:наименование\s+(?:организации|компании|поставщика|получателя)|организация|компания|поставщик|получатель|клиент|company\s+name|business\s+name|recipient)\s*[:№-]?\s*(.*)$/iu,/\s+(?=(?:бин|иин|инн|адрес|бик|кбе|и\s*и\s*к|iban)(?:\s|$))/iu);
 if(!name)name=lines.find(line=>/^(?:ТОО|ИП|АО|ООО|ОАО|ЗАО|LLP|LTD|LLC|JSC)(?=[\s«"“]|$)/i.test(line)&&!/(?:банк|bank)/i.test(line))||'';
 name=name.replace(/[;,]+$/,'').slice(0,150);
 const address=value(/(?:юридический\s+адрес|адрес\s+(?:регистрации|местонахождения|организации|компании)|адрес|legal\s+address|registered\s+address)\s*[:№-]?\s*(.*)$/iu,/\s+(?=(?:бин|иин|инн|бик|кбе|и\s*и\s*к|iban|тел\.?|телефон|email)(?:\s|$))/iu).slice(0,500);
 const bank=value(/(?:наименование\s+банка|банк\s+получателя|(?:^|\s)банк(?!а)|bank\s+name|\bbank\b)\s*[:№-]?\s*(.*)$/iu,/\s+(?=(?:бик|swift|bic|кбе|и\s*и\s*к|iban)(?:\s|$))/iu).slice(0,200);
 const email=(all.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
 const phoneRaw=value(/^\s*(?:телефон|тел\.?|мобильный|phone|mobile)\s*[:№-]?\s*(.*)$/iu),phone=(phoneRaw.match(/\+?\d[\d ()-]{7,}\d/)||[])[0]?.trim().slice(0,80)||'';
 return {name,email,phone,binIin,address,account,bic,kbe,bank};
}
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
function empty(lang='ru'){return {schema:1,settings:{business:'',contact:'',details:'',currency:'USD',language:lang},clients:[],invoices:[]};}
function text(o,k,max,required=false){if(!o||typeof o[k]!=='string'||o[k].length>max||(required&&!o[k].trim()))throw Error('text:'+k);}
function settings(s){text(s,'business',150);text(s,'contact',500);text(s,'details',2000);for(const [key,max] of Object.entries({binIin:30,address:500,account:60,bic:32,kbe:10,bank:200}))if(s[key]!==undefined)text(s,key,max);if(!CURRENCIES.includes(s.currency)||!['ru','en'].includes(s.language))throw Error('settings');}
function client(c){text(c,'id',100,true);text(c,'name',150,true);text(c,'email',200);text(c,'phone',80);text(c,'notes',2000);for(const [key,max] of Object.entries({binIin:30,address:500,account:60,bic:32,kbe:10,bank:200})){if(c[key]!==undefined)text(c,key,max);}}
function array(a,max){if(!Array.isArray(a)||a.length>max)throw Error('array');}
function validate(d){
 if(!d||d.schema!==1)throw Error('version');settings(d.settings);array(d.clients,10000);array(d.invoices,10000);
 const ids=new Set(),seqs=new Set(),clients=new Set();
 for(const c of d.clients){client(c);if(clients.has(c.id))throw Error('duplicate');clients.add(c.id);}
 for(const i of d.invoices){text(i,'id',100,true);if(ids.has(i.id))throw Error('duplicate');ids.add(i.id);if(!Number.isSafeInteger(i.seq)||i.seq<1||i.seq>1e8||seqs.has(i.seq))throw Error('seq');seqs.add(i.seq);if(!clients.has(i.clientId)||i.client.id!==i.clientId)throw Error('client');client(i.client);settings(i.seller);if(!dateOK(i.created)||!dateOK(i.due)||!CURRENCIES.includes(i.currency)||typeof i.cancelled!=='boolean')throw Error('invoice');text(i,'notes',2000);array(i.items,100);array(i.payments,1000);array(i.reminders,1000);if(i.items.length<1)throw Error('items');for(const l of i.items){text(l,'name',300,true);lineTotal(l);}if(total(i)>MAX)throw Error('total');const pids=new Set();for(const p of i.payments){text(p,'id',100,true);text(p,'note',500);if(pids.has(p.id))throw Error('duplicate');pids.add(p.id);if(!Number.isSafeInteger(p.amount)||p.amount<=0||p.amount>MAX||!dateOK(p.date))throw Error('payment');}if(balance(i)<0||(i.cancelled&&paid(i)>0))throw Error('balance');for(const r of i.reminders){text(r,'text',5000,true);if(!dateOK(r.date))throw Error('reminder');}}
 if(JSON.stringify(d).length>10*1024*1024)throw Error('size');return true;
}
function receivables(invoices,now=today()){
 const groups=new Map();for(const i of invoices){if(i.cancelled||balance(i)<=0)continue;if(!groups.has(i.currency))groups.set(i.currency,{currency:i.currency,current:0,days1to30:0,days31to60:0,days61plus:0,total:0,count:0});const g=groups.get(i.currency),days=Math.floor((Date.parse(now+'T12:00:00Z')-Date.parse(i.due+'T12:00:00Z'))/86400000),due=balance(i);g[days<=0?'current':days<=30?'days1to30':days<=60?'days31to60':'days61plus']+=due;g.total+=due;g.count++;}return [...groups.values()];
}
function invoiceCsv(invoices,lang='ru'){
 const labels=lang==='ru'?['Номер','Клиент','БИН/ИИН','Дата','Оплатить до','Валюта','Всего','Оплачено','Остаток','Статус']:['Number','Client','BIN/IIN','Issued','Due','Currency','Total','Paid','Balance','Status'];
 const names=lang==='ru'?{cancelled:'Отменён',paid:'Оплачен',partial:'Частичная оплата',overdue:'Просрочен',pending:'Ожидает оплаты'}:{cancelled:'Cancelled',paid:'Paid',partial:'Partly paid',overdue:'Overdue',pending:'Pending'};
 const cell=v=>'"'+String(/^[\s]*[=+@-]/.test(String(v))?"'"+v:v).replace(/"/g,'""')+'"';
 const rows=invoices.map(i=>['PF-'+String(i.seq).padStart(4,'0'),i.client.name,i.client.binIin||'',i.created,i.due,i.currency,(total(i)/100).toFixed(2),(paid(i)/100).toFixed(2),(i.cancelled?0:balance(i)/100).toFixed(2),names[status(i)]]);
 return '\ufeff'+[labels,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
class Store {
 constructor(data,persist=()=>{}){validate(data);this.data=clone(data);this.persist=persist;}
 change(fn){const next=clone(this.data);const result=fn(next);validate(next);this.persist(JSON.stringify(next));this.data=next;return result;}
 saveSettings(s){return this.change(d=>{d.settings=clone(s);});}
 saveClient(c,id){return this.change(d=>{const value={id:id||uid(),name:c.name.trim(),email:c.email.trim(),phone:c.phone.trim(),notes:c.notes.trim(),binIin:(c.binIin||'').trim(),address:(c.address||'').trim(),account:(c.account||'').trim(),bic:(c.bic||'').trim(),kbe:(c.kbe||'').trim(),bank:(c.bank||'').trim()};if(id){const at=d.clients.findIndex(c=>c.id===id);if(at<0)throw Error('missing');d.clients[at]=value;}else d.clients.push(value);return value.id;});}
 create(input){return this.change(d=>{const c=d.clients.find(c=>c.id===input.clientId);if(!c||!d.settings.business.trim())throw Error('client/business');const id=uid();d.invoices.push({id,seq:Math.max(0,...d.invoices.map(i=>i.seq))+1,clientId:c.id,client:clone(c),seller:clone(d.settings),currency:input.currency,created:today(),due:input.due,notes:input.notes.trim(),items:clone(input.items),payments:[],reminders:[],cancelled:false});return id;});}
 editInvoice(id,input){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(!i||i.cancelled)throw Error('closed');const c=d.clients.find(c=>c.id===input.clientId);if(!c)throw Error('client');if(paid(i)>0&&(input.currency!==i.currency||input.clientId!==i.clientId))throw Error('paid-fields');if(i.clientId!==input.clientId){i.clientId=c.id;i.client=clone(c);}i.currency=input.currency;i.due=input.due;i.notes=input.notes.trim();i.items=clone(input.items);if(total(i)<paid(i))throw Error('below-paid');return id;});}
 invoice(id){const i=this.data.invoices.find(i=>i.id===id);if(!i)throw Error('missing');return clone(i);}
 payment(id,amount,date,note){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(!i||i.cancelled||amount>balance(i)||date>today())throw Error('payment');i.payments.push({id:uid(),amount,date,note});});}
 removePayment(id,pid){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);const at=i.payments.findIndex(p=>p.id===pid);if(at<0)throw Error('missing');i.payments.splice(at,1);});}
 cancel(id){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(paid(i)>0)throw Error('paid');i.cancelled=!i.cancelled;});}
 remind(id,message){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(i.cancelled||balance(i)===0)throw Error('closed');i.reminders.push({date:today(),text:message});});}
 restore(raw){const next=JSON.parse(raw);validate(next);this.persist(JSON.stringify(next));this.data=clone(next);}
}
return {MAX,CURRENCIES,amount,lineTotal,total,paid,balance,status,money,today,addDays,dateOK,parseInvoiceText,parseClientRequisitesText,receivables,invoiceCsv,empty,validate,Store};
});
