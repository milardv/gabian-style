export function acceptsGzip(header=''){
 const entries=header.split(',').map(value=>value.trim().split(';').map(s=>s.trim())),entry=entries.find(parts=>parts[0].toLowerCase()==='gzip')||entries.find(parts=>parts[0]==='*');
 if(!entry)return false;
 const quality=entry.slice(1).find(value=>/^q\s*=/i.test(value));
 return quality===undefined||Number(quality.split('=')[1])>0;
}
const compressible=new Set(['.html','.js','.css','.json','.svg','.webmanifest']);
const memo=new Map();
// Text assets without a prebuilt .gz are compressed once per file version.
export function gzipStatic(path,ext,read,stat,gzip){
 if(!compressible.has(ext))return null;
 const {size,mtimeMs}=stat(path);if(size<1024)return null;
 const key=`${size}:${mtimeMs}`,cached=memo.get(path);if(cached?.key===key)return cached.bytes;
 const bytes=gzip(read(path));memo.set(path,{key,bytes});return bytes;
}
