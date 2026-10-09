const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function mapJSON(path,{fetcher=globalThis.fetch,delay=wait,attempts=3,timeoutMs=45000}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await fetcher(path,{signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok){const error=Error(`Cartographie indisponible (${response.status})`);error.retryable=[408,429,500,502,503,504].includes(response.status);throw error;}
   return await response.json();
  }catch(error){
   const network=error instanceof TypeError||['TimeoutError','AbortError','NetworkError'].includes(error.name);
   if(!(network||error.retryable))throw error;
   if(attempt===attempts-1)throw Error('Connexion à la carte interrompue. Réessaie avec Repartir ; les données déjà chargées sont conservées.');
   await delay(750*(attempt+1));
  }
 }
}
