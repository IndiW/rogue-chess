import {variantBestMove} from './variant-engine.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,move:variantBestMove(data.state,data.settings)});}catch(error){self.postMessage({id:data.id,error:true});}};
