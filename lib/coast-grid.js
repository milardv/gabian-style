export function splitTerrainGrid(grid,quarter){
 const half=(grid.size-1)/2,n=half+1,ox=(quarter%2)*half,oz=Math.floor(quarter/2)*half,[w,north,e,s]=grid.bounds;
 const heights=[];for(let z=0;z<n;z++)for(let x=0;x<n;x++)heights.push(grid.heights[(oz+z)*grid.size+ox+x]);
 return {size:n,bounds:[w+(e-w)*(quarter%2)/2,north+(s-north)*Math.floor(quarter/2)/2,w+(e-w)*((quarter%2)+1)/2,north+(s-north)*(Math.floor(quarter/2)+1)/2],heights};
}
