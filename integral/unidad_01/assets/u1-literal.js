(()=>{
  const slides=[...document.querySelectorAll('#deck>.slide')];
  const progress=document.querySelector('.progress span');
  const live=document.querySelector('#live-status');
  const map=document.querySelector('#slide-map');
  let current=0;
  const clamp=index=>(index+slides.length)%slides.length;
  const fit=()=>{
    const width=window.innerWidth;
    const height=window.innerHeight-126;
    document.documentElement.style.setProperty('--deck-scale',Math.min(width/1280,height/720,1));
  };
  const show=(index,{hash=true}={})=>{
    const next=clamp(index);
    slides.forEach((slide,i)=>{slide.classList.toggle('active',i===next);slide.dataset.active=String(i===next)});
    current=next;
    progress.style.width=`${((current+1)/slides.length)*100}%`;
    if(live)live.textContent=`Diapositiva ${current+1} de ${slides.length}`;
    if(hash)history.replaceState(null,'',`#${slides[current].id}`);
  };
  const fromHash=()=>{
    const index=slides.findIndex(slide=>`#${slide.id}`===location.hash);
    show(index<0?0:index,{hash:index>=0});
  };
  document.querySelector('[data-action="home"]').addEventListener('click',()=>show(0));
  document.querySelector('[data-action="previous"]').addEventListener('click',()=>show(current-1));
  document.querySelector('[data-action="next"]').addEventListener('click',()=>show(current+1));
  document.querySelector('[data-action="map"]').addEventListener('click',()=>map.showModal());
  document.querySelector('[data-action="close-map"]').addEventListener('click',()=>map.close());
  document.querySelectorAll('[data-slide-target]').forEach(button=>button.addEventListener('click',()=>{
    show(Number(button.dataset.slideTarget));
    if(map.open)map.close();
  }));
  const references=document.querySelector('[data-action="references"]');
  if(references)references.addEventListener('click',event=>{
    event.preventDefault();
    const firstReference=slides.findIndex(slide=>slide.id==='referencias-1');
    show(firstReference<0?slides.length-1:firstReference);
  });
  addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='PageUp')show(current-1);
    if(event.key==='ArrowRight'||event.key==='PageDown'||event.key===' ')show(current+1);
    if(event.key==='Home')show(0);
    if(event.key==='End')show(slides.length-1);
  });
  addEventListener('hashchange',fromHash);addEventListener('resize',fit);fit();fromHash();
  const updateConceptProgress=slide=>{
    const current=slide.querySelector('.concept-progress-current');
    if(current)current.textContent=String(Number(slide.dataset.fragmentIndex||0)+1);
  };
  document.querySelectorAll('.slide[data-progressive="true"]').forEach(updateConceptProgress);
  new MutationObserver(records=>records.forEach(record=>updateConceptProgress(record.target)))
    .observe(document.querySelector('#deck'),{subtree:true,attributes:true,attributeFilter:['data-fragment-index']});
})();
