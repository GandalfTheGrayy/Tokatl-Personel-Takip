export type Role='ADMIN'|'SUPERVISOR'|'STAFF';
export type User={id:string;username:string;name:string;role:Role;active:boolean;mustChangePassword:boolean};
export type Settings={id:number;institutionName:string;logoData:string|null;leaveCategories:string[]};
export type Schedule={startTime:string;endTime:string;toleranceMinutes:number;veryLateMinutes:number;timezone:string};
export type RecordStatus='PENDING'|'APPROVED'|'REJECTED';
export type Attendance={id:string;userId:string;day:string;checkedInAt:string;note:string;status:RecordStatus;arrival:'ON_TIME'|'LATE'|'VERY_LATE';user?:{name:string;username:string};type?:'ATTENDANCE'};
export type Leave={id:string;userId:string;day:string;category:string;note:string;status:RecordStatus;user?:{name:string;username:string};type?:'LEAVE'};
export type Entry=Attendance|Leave;
let csrf='';export const setCsrf=(value:string)=>{csrf=value};
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{const response=await fetch(`/api${path}`,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(!['GET','HEAD'].includes(options.method||'GET')?{'X-CSRF-Token':csrf}:{}),...options.headers}});let data:any;try{data=await response.json()}catch{throw Error('Sunucu yanıtı okunamadı.')}if(!response.ok)throw Error(data.error||'İşlem tamamlanamadı.');return data as T}
export const post=<T>(path:string,data:unknown,method='POST')=>api<T>(path,{method,body:JSON.stringify(data)});
export async function download(path:string,name:string){const response=await fetch(`/api${path}`,{credentials:'same-origin'});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Dosya indirilemedi.')}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export const dateTR=(date:string)=>new Date(`${date.slice(0,10)}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});
export const timeTR=(iso:string)=>new Date(iso).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'});
export const statusText=(value:string)=>({PENDING:'Onay bekliyor',APPROVED:'Onaylandı',REJECTED:'Reddedildi',ON_TIME:'Saatinde',LATE:'Geç',VERY_LATE:'Çok geç',ABSENT:'Gelmedi'}[value]||value);
