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
function parseInvoiceText(raw){
 const textValue=String(raw??'').normalize('NFKC').replace(/[\u00a0\u202f]/g,' ').replace(/[\t\r]+/g,' ');
 const lines=textValue.split('\n').map(x=>x.trim().replace(/\s{2,}/g,' ')).filter(Boolean);
 const findValue=(pattern)=>{for(let n=0;n<lines.length;n++){const m=lines[n].match(pattern);if(m){const same=(m[1]||'').trim();if(same)return same;const next=lines[n+1]||'';if(next&&!/^(?:инн|кпп|огрн)\b/i.test(next))return next;}}return '';};
 const parseDate=value=>{let m=String(value).match(/(?<!\d)(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)/);let y,mo,d;if(m){[,y,mo,d]=m;}else{m=String(value).match(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/);if(!m)return null;[,d,mo,y]=m;}const result=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return dateOK(result)?result:null;};
 const dueValue=findValue(/(?:срок\s+(?:оплаты|платежа)|оплатить\s+до|дата\s+оплаты|due\s+date)\s*[:№-]?\s*(.*)$/iu);
 let clientName=findValue(/(?:покупатель|заказчик|получатель|контрагент|клиент|bill\s+to|customer)\s*[:№-]?\s*(.*)$/iu);
 clientName=clientName.split(/\s+(?=(?:ИНН|КПП|ОГРН)(?:\s|$)|(?:тел\.?|телефон|e-?mail)(?:\s|$))/iu)[0].trim().replace(/[;,]+$/,'').slice(0,150);
 const currencyOf=value=>{if(/(?:\bRUB\b|₽|руб(?:\.|лей|ля|ль)?)/iu.test(value))return 'RUB';if(/(?:\bUSD\b|\$)/i.test(value))return 'USD';if(/(?:\bEUR\b|€)/i.test(value))return 'EUR';if(/(?:\bGBP\b|£)/i.test(value))return 'GBP';if(/\bKZT\b|₸/i.test(value))return 'KZT';return null;};
 const currency=lines.map(line=>({line,currency:currencyOf(line)})).find(x=>x.currency&&/(?:итого|всего|к оплате|total|amount due|сумма к оплате)/i.test(x.line))?.currency||lines.map(currencyOf).find(Boolean)||currencyOf(textValue);
 const items=[];const amount='\\d[\\d.,]*';
 const ignored=/^(?:итого|всего|к оплате|сумма|ндс|налог|количество|кол-?во|наименование|цена|стоимость|срок|покупатель|заказчик|получатель|контрагент|клиент|инн|кпп|огрн)\b/i;
 for(const source of lines){
  let line=source.replace(/(\d)\s(?=\d{3}(?:[.,]\d{2})?\b)/g,'$1').replace(/(?:₽|руб(?:\.|лей|ля|ль)?|RUB|USD|EUR|GBP|KZT|[$€£₸])/giu,'').trim();
  if(ignored.test(line))continue;
  const match=line.match(new RegExp(`^(.{2,}?)\\s+(\\d{1,6})(?:\\s*(?:шт\\.?|ед\\.?|усл\\.?|час(?:а|ов)?|ч\\.?))?\\s+(${amount})\\s+(${amount})\\s*$`,'iu'));
  if(!match)continue;
  const name=match[1].replace(/^\d+[.)]?\s*/,'').trim(),qty=Number(match[2]),unit=parseOcrMoney(match[3]);
  if(!name||name.length>300||!Number.isSafeInteger(qty)||qty<1||qty>100000||!unit||qty*unit>MAX)continue;
  items.push({name,qty,unit});if(items.length>=100)break;
 }
 let total=null;
 if(!items.length){for(const source of lines){const line=source.replace(/(\d)\s(?=\d{3}(?:[.,]\d{2})?\b)/g,'$1').replace(/(?:₽|руб(?:\.|лей|ля|ль)?|RUB|USD|EUR|GBP|KZT|[$€£₸])/giu,'').trim();const m=line.match(new RegExp(`^(?:итого(?:\\s+к\\s+оплате)?|всего\\s+к\\s+оплате|сумма\\s+к\\s+оплате|к\\s+оплате|total|amount\\s+due)\\s*[:=]?\\s*(${amount})\\s*$`,'iu'));if(m){total=parseOcrMoney(m[1]);if(total)break;}}if(total)items.push({name:'Услуги по счёту',qty:1,unit:total});}
 if(!total&&items.length){const sum=items.reduce((n,item)=>n+item.qty*item.unit,0);if(Number.isSafeInteger(sum)&&sum<=MAX)total=sum;}
 return {clientName,due:parseDate(dueValue),currency,items,total};
}
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
function empty(lang='ru'){return {schema:1,settings:{business:'',contact:'',details:'',currency:'USD',language:lang},clients:[],invoices:[]};}
function text(o,k,max,required=false){if(!o||typeof o[k]!=='string'||o[k].length>max||(required&&!o[k].trim()))throw Error('text:'+k);}
function settings(s){text(s,'business',150);text(s,'contact',500);text(s,'details',2000);if(!CURRENCIES.includes(s.currency)||!['ru','en'].includes(s.language))throw Error('settings');}
function client(c){text(c,'id',100,true);text(c,'name',150,true);text(c,'email',200);text(c,'phone',80);text(c,'notes',2000);}
function array(a,max){if(!Array.isArray(a)||a.length>max)throw Error('array');}
function validate(d){
 if(!d||d.schema!==1)throw Error('version');settings(d.settings);array(d.clients,10000);array(d.invoices,10000);
 const ids=new Set(),seqs=new Set(),clients=new Set();
 for(const c of d.clients){client(c);if(clients.has(c.id))throw Error('duplicate');clients.add(c.id);}
 for(const i of d.invoices){text(i,'id',100,true);if(ids.has(i.id))throw Error('duplicate');ids.add(i.id);if(!Number.isSafeInteger(i.seq)||i.seq<1||i.seq>1e8||seqs.has(i.seq))throw Error('seq');seqs.add(i.seq);if(!clients.has(i.clientId)||i.client.id!==i.clientId)throw Error('client');client(i.client);settings(i.seller);if(!dateOK(i.created)||!dateOK(i.due)||!CURRENCIES.includes(i.currency)||typeof i.cancelled!=='boolean')throw Error('invoice');text(i,'notes',2000);array(i.items,100);array(i.payments,1000);array(i.reminders,1000);if(i.items.length<1)throw Error('items');for(const l of i.items){text(l,'name',300,true);lineTotal(l);}if(total(i)>MAX)throw Error('total');const pids=new Set();for(const p of i.payments){text(p,'id',100,true);text(p,'note',500);if(pids.has(p.id))throw Error('duplicate');pids.add(p.id);if(!Number.isSafeInteger(p.amount)||p.amount<=0||p.amount>MAX||!dateOK(p.date))throw Error('payment');}if(balance(i)<0||(i.cancelled&&paid(i)>0))throw Error('balance');for(const r of i.reminders){text(r,'text',5000,true);if(!dateOK(r.date))throw Error('reminder');}}
 if(JSON.stringify(d).length>10*1024*1024)throw Error('size');return true;
}
class Store {
 constructor(data,persist=()=>{}){validate(data);this.data=clone(data);this.persist=persist;}
 change(fn){const next=clone(this.data);const result=fn(next);validate(next);this.persist(JSON.stringify(next));this.data=next;return result;}
 saveSettings(s){return this.change(d=>{d.settings=clone(s);});}
 saveClient(c,id){return this.change(d=>{const value={id:id||uid(),name:c.name.trim(),email:c.email.trim(),phone:c.phone.trim(),notes:c.notes.trim()};if(id){const at=d.clients.findIndex(c=>c.id===id);if(at<0)throw Error('missing');d.clients[at]=value;}else d.clients.push(value);return value.id;});}
 create(input){return this.change(d=>{const c=d.clients.find(c=>c.id===input.clientId);if(!c||!d.settings.business.trim())throw Error('client/business');const id=uid();d.invoices.push({id,seq:Math.max(0,...d.invoices.map(i=>i.seq))+1,clientId:c.id,client:clone(c),seller:clone(d.settings),currency:input.currency,created:today(),due:input.due,notes:input.notes.trim(),items:clone(input.items),payments:[],reminders:[],cancelled:false});return id;});}
 editInvoice(id,input){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(!i||i.cancelled)throw Error('closed');const c=d.clients.find(c=>c.id===input.clientId);if(!c)throw Error('client');if(paid(i)>0&&(input.currency!==i.currency||input.clientId!==i.clientId))throw Error('paid-fields');if(i.clientId!==input.clientId){i.clientId=c.id;i.client=clone(c);}i.currency=input.currency;i.due=input.due;i.notes=input.notes.trim();i.items=clone(input.items);if(total(i)<paid(i))throw Error('below-paid');return id;});}
 invoice(id){const i=this.data.invoices.find(i=>i.id===id);if(!i)throw Error('missing');return clone(i);}
 payment(id,amount,date,note){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(!i||i.cancelled||amount>balance(i)||date>today())throw Error('payment');i.payments.push({id:uid(),amount,date,note});});}
 removePayment(id,pid){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);const at=i.payments.findIndex(p=>p.id===pid);if(at<0)throw Error('missing');i.payments.splice(at,1);});}
 cancel(id){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(paid(i)>0)throw Error('paid');i.cancelled=!i.cancelled;});}
 remind(id,message){return this.change(d=>{const i=d.invoices.find(i=>i.id===id);if(i.cancelled||balance(i)===0)throw Error('closed');i.reminders.push({date:today(),text:message});});}
 restore(raw){const next=JSON.parse(raw);validate(next);this.persist(JSON.stringify(next));this.data=clone(next);}
}
return {MAX,CURRENCIES,amount,lineTotal,total,paid,balance,status,money,today,addDays,dateOK,parseInvoiceText,empty,validate,Store};
});
