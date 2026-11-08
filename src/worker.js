import {bestMove} from './engine.js';
self.onmessage=({data})=>{try{self.postMessage({...data,move:bestMove(data.fen,data.depth)});}catch{self.postMessage({...data,error:true});}};
