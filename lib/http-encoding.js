export function acceptsGzip(header=''){
 const entries=header.split(',').map(value=>value.trim().split(';').map(s=>s.trim())),entry=entries.find(parts=>parts[0].toLowerCase()==='gzip')||entries.find(parts=>parts[0]==='*');
 if(!entry)return false;
 const quality=entry.slice(1).find(value=>/^q\s*=/i.test(value));
 return quality===undefined||Number(quality.split('=')[1])>0;
}
