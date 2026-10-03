const canvas=document.querySelector('#game');
const ctx=canvas.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=false;
const ui={chapter:document.querySelector('#chapter'),objective:document.querySelector('#objective'),hint:document.querySelector('#hint'),dialogue:document.querySelector('#dialogue'),portrait:document.querySelector('#portrait'),speaker:document.querySelector('#speaker'),line:document.querySelector('#line'),toast:document.querySelector('#toast'),overlay:document.querySelector('#overlayScene'),pause:document.querySelector('#pause'),ending:document.querySelector('#endingCard'),gameover:document.querySelector('#gameover'),stage:document.querySelector('#stage')};
const files={
 apartment:'./asserts/apartment.png',gift:'./asserts/gift.png',
 portraitHome:'./asserts/portrait-vladimir.png',portraitDasha:'./asserts/portrait-dasha.png',portraitVarya:'./asserts/Картинка №11.png',portraitSasha:'./asserts/portrait-sasha.png',portraitTimoha:'./asserts/portrait-timoha.png',
 street:'./asserts/street.jpg',car:'./asserts/car.jpg',building:'./asserts/building.jpg',lobby:'./asserts/lobby.jpg',hall2:'./asserts/Картинка №22.png',hall30:'./asserts/Картинка №30.png',office:'./asserts/office.jpg',class:'./asserts/class.jpg',comp:'./asserts/comp.png',notification:'./asserts/notification.jpg',message:'./asserts/message.jpg',reply:'./asserts/reply.jpg',desktop:'./asserts/desktop.jpg',explorer:'./asserts/explorer.jpg',
 vladimirBack:'./asserts/vladimir-back.png',vladimirSide:'./asserts/vladimir-side.png',vladimirRight:'./asserts/vladimir-right.png'
};
const imgs={};for(const [key,path] of Object.entries(files)){const im=new Image();im.decoding='async';im.src=path;imgs[key]=im;}

for(const [key,im] of Object.entries(imgs)){im.addEventListener('error',()=>console.error('Не удалось загрузить изображение:',key));}
Promise.all(Object.values(imgs).map(im=>im.decode?im.decode().catch(()=>{}):Promise.resolve())).then(()=>{document.documentElement.classList.add('assets-ready');});
const portraits={'Владимир Иванович':'portraitHome','Даша':'portraitDasha','Варя':'portraitVarya','Тимоха':'portraitTimoha','Саша Раев':'portraitSasha'};
const HOME_Y=333,BIG_SCALE=.575,DOOR_407={x:40,y:198,r:80},DOOR_404={x:604,y:198,r:80},PHONE={x:386,y:202,r:78},USB={x:378,y:246,r:88};
let scene='home',route='stairs',player={x:92,y:HOME_Y,face:1,dx:0,dy:0},keys=new Set(),dialog=null,paused=false,gameOver=false,endingReady=false,drive={progress:0,speed:0,x:320,y:278,traffic:[],spawn:0,lastCrash:0,shake:0,fade:-1},clock=0,lastFrame=0,pickupUntil=0,confettiParts=[],pendingPhone=false,hoverTimer=0;
function setChapter(text,objective){ui.chapter.textContent=text;ui.objective.textContent=objective;}
function closeDialogue(){dialog=null;ui.dialogue.hidden=true;ui.dialogue.classList.remove('narration');ui.speaker.textContent='';ui.line.textContent='';ui.portrait.removeAttribute('src');}
function talk(lines,done=()=>{}){keys.clear();dialog={lines,index:0,done};ui.dialogue.hidden=false;paintDialogue();}
function paintDialogue(){if(!dialog)return;const line=dialog.lines[dialog.index];if(line.cap){ui.dialogue.classList.add('narration');ui.speaker.textContent='';ui.line.textContent=line.text;ui.portrait.removeAttribute('src');return;}ui.dialogue.classList.remove('narration');ui.speaker.textContent=line.speaker;ui.line.textContent=line.text;const src=files[portraits[line.speaker]||'portraitHome'];ui.portrait.src=src;ui.portrait.alt=line.speaker;}
function advance(){if(!dialog)return;dialog.index++;if(dialog.index>=dialog.lines.length){const done=dialog.done;closeDialogue();done();return;}paintDialogue();}
function line(speaker,text){return {speaker,text};}
function cap(text){return {speaker:'',text,cap:true};}
let toastTimer=0;function toast(text,ms=1400){ui.toast.textContent=text;ui.toast.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('on'),ms);}
function visual(key,label='',full=false){ui.overlay.innerHTML='';ui.overlay.classList.toggle('full',full);if(label){const title=document.createElement('div');title.className='overlay-label';title.textContent=label;ui.overlay.append(title);}const image=document.createElement('img');image.src=files[key]||'';image.alt=label;ui.overlay.append(image);ui.overlay.hidden=false;}
function hideVisual(){ui.overlay.hidden=true;ui.overlay.innerHTML='';ui.overlay.classList.remove('full');}
function changeScene(name,x=85,y=270){scene=name;player={x,y,face:1,dx:0,dy:0};keys.clear();hideVisual();ui.ending.hidden=true;endingReady=false;}
function object(){switch(scene){case'home':return{x:585,y:288,label:'Выйти из дома',r:96};case'street':return{x:430,y:196,label:'Сесть в машину',r:172};case'outside':return{x:335,y:237,label:'Войти в МИФИ',r:165};case'lobby':return{x:315,y:267,label:'В коридор',r:74};case'hall':return route==='stairs'?{x:578,y:198,label:'Подняться на 4 этаж',r:78}:route==='404'?{x:DOOR_404.x,y:DOOR_404.y,label:'Войти в кабинет 404',r:DOOR_404.r}:{x:DOOR_407.x,y:DOOR_407.y,label:'Вернуться в кабинет 407',r:DOOR_407.r};case'floor4':return{x:DOOR_407.x,y:DOOR_407.y,label:'Войти в кабинет 407',r:DOOR_407.r};case'officeMsg':return{x:PHONE.x,y:PHONE.y,label:'Прочитать сообщение',r:PHONE.r};case'room404':return pickupUntil>clock?null:{x:USB.x,y:USB.y,label:'Взять флешку',r:USB.r};case'officeReturn':return{x:330,y:214,label:'Открыть компьютер',r:205};default:return null;}}
// Walkable area per scene. `y` alone = vertical movement is locked (side-on scenes).
function bounds(){if(scene==='home')return{x0:27,x1:600,y:HOME_Y,lock:true};if(scene==='class')return{x0:236,x1:404,y:172,lock:true};return{x0:27,x1:613,y0:145,y1:319,lock:false};}
function currentBackdrop(){if(scene==='home')return'apartment';if(scene==='street')return'street';if(scene==='outside')return'building';if(scene==='lobby')return'lobby';if(scene==='hall')return route==='stairs'?'hall2':'hall30';if(scene==='floor4')return'hall30';if(scene==='office'||scene==='officeMsg'||scene==='officeReturn')return'office';if(scene==='class')return'class';if(scene==='room404')return'comp';return null;}
function spriteScale(){return (scene==='home'||scene==='office'||scene==='officeMsg'||scene==='officeReturn')?BIG_SCALE:.23;}
function centerCover(im){const scale=Math.max(640/im.width,360/im.height);const w=im.width*scale,h=im.height*scale;ctx.drawImage(im,(640-w)/2,(360-h)/2,w,h);}
// Fits the whole image inside the frame — nothing gets cropped.
function centerContain(im){const scale=Math.min(640/im.width,360/im.height);const w=Math.round(im.width*scale),h=Math.round(im.height*scale);ctx.drawImage(im,Math.round((640-w)/2),Math.round((360-h)/2),w,h);}
function px(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
// Pulsing marker that points at an interactive spot on top of the photo.
function spotlight(bx,by,w,h,top,bottom){const pulse=Math.sin(clock*3.4)*.5+.5;ctx.save();ctx.globalAlpha=.26+pulse*.3;px(bx-w/2,by-h/2,w,h,'#f2d87d');ctx.globalAlpha=1;ctx.strokeStyle='#fff3c4';ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.lineDashOffset=-clock*22;ctx.strokeRect(bx-w/2,by-h/2,w,h);ctx.setLineDash([]);ctx.strokeStyle='#8a6a1c';ctx.lineWidth=1;ctx.strokeRect(bx-w/2-4,by-h/2-4,w+8,h+8);ctx.fillStyle='#ffe9a8';ctx.textAlign='center';ctx.font='bold 14px monospace';ctx.fillText(top,bx,by-h/2-14);if(bottom){ctx.font='bold 10px monospace';ctx.fillText(bottom,bx,by+h/2+16);}ctx.restore();ctx.textAlign='left';}
function character(x,y,scale=1,coat='#273343',face=1,phase=0,crouch=false){const s=scale,step=Math.sin(phase*10)*2*s,base=crouch?4*s:0;ctx.fillStyle='#1b2022';ctx.fillRect(x-12*s,y-3*s,24*s,5*s);px(x-6*s,y-30*s+base,12*s,11*s,'#efbd99');px(x-7*s,y-34*s+base,14*s,7*s,'#493126');px(x-9*s,y-26*s+base,3*s,4*s,'#efbd99');px(x+6*s,y-26*s+base,3*s,4*s,'#efbd99');px(x-5*s,y-23*s+base,2*s,2*s,'#28333b');px(x+3*s,y-23*s+base,2*s,2*s,'#28333b');px(x-9*s,y-19*s+base,18*s,16*s,coat);px(x-7*s,y-4*s+base,5*s,5*s,'#303746');px(x+2*s,y-4*s+base,5*s,5*s,'#303746');px(x-7*s+step,y+1*s,5*s,9*s,'#32303a');px(x+2*s-step,y+1*s,5*s,9*s,'#32303a');px(x-9*s+step,y+8*s,7*s,3*s,'#171a20');px(x+1*s-step,y+8*s,8*s,3*s,'#171a20');if(crouch){px(x+8*s,y-12*s,9*s,3*s,'#efbd99');}}
function drawCharacterSprite(x,y,scale=0.23,face=1){
  // Dedicated art per heading: walking up = back view №20, walking left = side view №21
  // (already facing left), walking right = mirrored side view vladimir-right.png.
  const key=player.dy<0?'vladimirBack':player.dx<0?'vladimirSide':player.dx>0?'vladimirRight':(scene==='home'||scene==='class')?(face<0?'vladimirSide':'vladimirRight'):'vladimirBack';
  const im=imgs[key];
  if(!im||!im.complete||!im.naturalWidth)return;
  const h=92*scale/0.23, w=im.naturalWidth*(h/im.naturalHeight);
  ctx.drawImage(im,x-w/2,y-h+4,w,h);
}
function drawCar(x,y,color='#397cb8',scale=1){const s=scale;px(x-11*s,y-19*s,22*s,38*s,'#14232e');px(x-9*s,y-17*s,18*s,34*s,color);px(x-7*s,y-10*s,14*s,9*s,'#a8ccd0');px(x-7*s,y+3*s,14*s,8*s,'#1d3340');px(x-7*s,y-17*s,4*s,3*s,'#ffe39a');px(x+3*s,y-17*s,4*s,3*s,'#ffe39a');px(x-13*s,y-12*s,3*s,8*s,'#11161b');px(x+10*s,y-12*s,3*s,8*s,'#11161b');px(x-13*s,y+9*s,3*s,8*s,'#11161b');px(x+10*s,y+9*s,3*s,8*s,'#11161b');px(x-7*s,y+15*s,4*s,2*s,'#ff6a58');px(x+3*s,y+15*s,4*s,2*s,'#ff6a58');}
const LANES=[172,246,320,394,468],CAR_COLORS=['#93aa47','#cf7657','#bac1b4','#d5a34f'];
function drawRoad(dt){px(0,0,640,360,'#719c50');let offset=(drive.progress*2)%72;for(let y=-72+offset;y<390;y+=75){px(30,y,28,26,'#437843');px(34,y-5,20,15,'#62934a');px(584,y+16,28,29,'#437843');px(588,y+9,19,18,'#719950');px(78,y+40,7,8,'#b99a66');px(555,y+52,8,8,'#cfb978');}px(125,0,390,360,'#696f69');px(134,0,372,360,'#39464b');px(139,0,362,360,'#46545a');px(313,0,4,360,'#e4d181');px(316,0,2,360,'#88784d');for(let y=-52+offset;y<400;y+=58){for(const lx of[209,283,357,431])px(lx,y,4,30,'#e8e8ce');}for(let y=-46+offset;y<400;y+=119){px(124,y,11,18,'#ddd2b1');px(503,y+30,7,13,'#c6a35d');}ctx.fillStyle='#192026';ctx.font='bold 11px monospace';ctx.fillText('МИФИ  →',25,29);ctx.fillStyle='#f1d88f';ctx.fillText(Math.min(100,Math.floor(drive.progress/16))+'%',563,31);
 const dtSafe=Math.min(dt,.04);
 if(drive.fade<0){drive.spawn-=dtSafe;if(drive.spawn<=0){const lane=LANES[Math.floor(Math.random()*LANES.length)];drive.traffic.push({x:lane,y:-34,color:CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)],speed:.82+Math.random()*.46});drive.spawn=.58+Math.random()*.4;}for(const car of drive.traffic){car.y+=(125*car.speed+drive.speed*22)*dtSafe;drawCar(car.x,car.y,car.color,.8);if(Math.abs(car.x-drive.x)<23&&Math.abs(car.y-drive.y)<40&&clock-drive.lastCrash>1.6){drive.lastCrash=clock;drive.shake=.24;drive.progress=Math.max(0,drive.progress-22);drive.x+=drive.x<car.x?-37:37;toast('Ай! Аккуратнее!',1450);tone(110,.12,'square');} }drive.traffic=drive.traffic.filter(c=>c.y<410);}else drive.traffic.length=0;
 drawCar(drive.x,drive.y,'#326fbd',1.05);}
function draw(){const dt=Math.min(clock-lastFrame,.04)||0;lastFrame=clock;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,640,360);
 if(scene==='desktop'){const im=imgs.desktop;if(im.complete&&im.naturalWidth)ctx.drawImage(im,0,0,640,360);return;}
 if(scene==='explorer'||scene==='desktop'){const im=imgs[scene];if(im.complete&&im.naturalWidth)ctx.drawImage(im,0,0,640,360);if(scene==='explorer'&&!dialog){setChapter('Неизвестная флешка','Откройте папку «Любимому куратору»');ui.hint.textContent='Наведите мышку на папку «Любимому куратору», чтобы открыть её';ui.hint.classList.add('on');}else{ui.hint.classList.remove('on');}return;}
  if(scene==='ending'){const im=imgs.gift;const g=ctx.createLinearGradient(0,0,0,360);g.addColorStop(0,'#1a2432');g.addColorStop(1,'#0e151f');ctx.fillStyle=g;ctx.fillRect(0,0,640,360);if(im.complete&&im.naturalWidth)centerContain(im);for(const p of confettiParts){p.y+=p.v*dt;if(p.y>360){p.y=-5;p.x=Math.random()*640;}p.x+=Math.sin(clock*2+p.s)*.35;px(p.x,p.y,p.s,p.s*2,p.c);}return;}
  if(scene==='drive'){ui.hint.classList.remove('on');if(drive.shake>0){drive.shake-=dt;ctx.save();ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*4);}drawRoad(dt);if(drive.shake>0)ctx.restore();drive.progress+=drive.speed*dt*62;if(keys.has('ArrowUp')||keys.has('KeyW'))drive.speed=Math.min(1.5,drive.speed+dt*.92);else drive.speed=Math.max(.48,drive.speed-dt*.2);if(keys.has('ArrowDown')||keys.has('KeyS'))drive.speed=Math.max(.22,drive.speed-dt*1.6);if(keys.has('ArrowLeft')||keys.has('KeyA'))drive.x-=dt*155;if(keys.has('ArrowRight')||keys.has('KeyD'))drive.x+=dt*155;drive.x=Math.max(163,Math.min(477,drive.x));
   if(drive.progress>=1600&&drive.fade<0)drive.fade=0;
   if(drive.fade>=0){drive.fade=Math.min(1,drive.fade+dt/1.15);const e=drive.fade*drive.fade*(3-2*drive.fade),b=imgs.building;if(b.complete&&b.naturalWidth){ctx.save();ctx.globalAlpha=e;ctx.imageSmoothingEnabled=true;centerCover(b);ctx.restore();ctx.imageSmoothingEnabled=false;}if(drive.fade>=1){scene='outside';player={x:91,y:270,face:1,dx:0,dy:0};drive.progress=0;drive.fade=-1;toast('Вы приехали!',1800);setChapter('У входа в МИФИ','Подойдите ко входу');}}
   return;}
 const bg=currentBackdrop(),im=bg&&imgs[bg];if(im?.complete&&im.naturalWidth)centerCover(im);else px(0,0,640,360,'#283748');
 // Small scene-specific details make the still reference art part of a playable space.
 if(scene==='street'){const c=imgs.car;if(c.complete&&c.naturalWidth){ctx.imageSmoothingEnabled=true;const sw=c.naturalWidth*.21,sh=c.naturalHeight*.235,ar=sw/sh;let dw=124,dh=dw/ar;if(dh>58){dh=58;dw=dh*ar;}ctx.drawImage(c,c.naturalWidth*.612,c.naturalHeight*.437,sw,sh,436-dw/2,196-dh/2,dw,dh);ctx.imageSmoothingEnabled=false;}}
 if(scene==='hall'||scene==='floor4'){/* Лестница и двери — часть фотографии: зоны входа невидимы, как у машины. */}
    if(scene==='officeMsg')spotlight(PHONE.x,PHONE.y,108,52,'ТЕЛЕФОН','ЗДЕСЬ');
    if(scene==='room404'&&pickupUntil<clock)spotlight(USB.x,USB.y,92,30,'ФЛЕШКА','ЗДЕСЬ');
    if(scene!=='class')drawCharacterSprite(player.x,player.y,spriteScale(),player.face);
   const obj=object(),near=obj&&Math.hypot(obj.x-player.x,obj.y-player.y)<obj.r&&!dialog&&!paused;
   if(pendingPhone&&scene==='officeMsg'){ui.hint.textContent='[ENTER] Открыть сообщение';ui.hint.classList.add('on');}
   else{ui.hint.textContent=near?'[E] '+obj.label:'';ui.hint.classList.toggle('on',Boolean(near));}
   if(scene==='home')setChapter('Квартира · 08:10','Пора на работу');else if(scene==='street')setChapter('Улица · машина рядом','Подойдите к машине');else if(scene==='outside')setChapter('МИФИ · главный вход','Войдите в здание');else if(scene==='lobby')setChapter('Первый этаж','Найдите коридор');else if(scene==='hall')setChapter(route==='stairs'?'Коридор · первый этаж':route==='404'?'Коридор · кабинет 404':'Коридор · кабинет 407',route==='stairs'?'Найдите лестницу на четвёртый этаж':'Найдите нужный кабинет');else if(scene==='floor4')setChapter('Четвёртый этаж','Войдите в кабинет 407');else if(scene==='office')setChapter('Кабинет 407','');else if(scene==='officeMsg')setChapter('Кабинет 407',pendingPhone?'Телефон вибрирует — нажмите ENTER':'Телефон на столе');else if(scene==='room404')setChapter('Кабинет 404','Поищите флешку у кафедры');else if(scene==='officeReturn')setChapter('Кабинет 407','Подойдите к компьютеру');
  }
function tone(freq=440,duration=.07,type='sine'){try{const ac=tone.ac||(tone.ac=new AudioContext()),o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.045,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+duration);}catch{}}
function enterRoom(){changeScene('office',85,270);setChapter('Кабинет 407','');talk([  line('Владимир Иванович','Так, пара в л 207 мои исики')],()=>{toast('Некоторое время спустя...',2100);setTimeout(()=>talk([line('Владимир Иванович','Время идти на пару.')],()=>startClass()),2150);});}
function startClass(){changeScene('class',320,172);setChapter('Аудитория · занятие началось','Занятие идёт');talk([
 line('Владимир Иванович','Доброе утро, коллеги.'),
 line('Владимир Иванович','Ну что расскажете, что предложите?)'),
 line('Владимир Иванович','Ой, подождите....'),
 line('Владимир Иванович','Даша, подойди сюда.'),
 line('Даша','Да?'),
 line('Владимир Иванович','На тебе карточку, купи мне как обычно.'),
line('Владимир Иванович','*Подмигнул ей*'),
  line('Даша','Хорошо, Владимир Иванович.'),
  cap('Девочки ушли из аудитории.'),
 line('Владимир Иванович','Ну что коллеги? Кто помнит на чем мы остановились...'),
 line('Владимир Иванович','*Владимир Иванович вставляет флешку в компьютер и открывает презентацию для лекции, ворча себе под нос*'),
 line('Владимир Иванович','Записываем новую тему...'),
 cap('Продолжает вести пару'),
  cap('*Замечает как Варя смотрит в тетрадь Фёдора*'),
  line('Владимир Иванович','Варя, хватит списывать у Фёдора'),
 line('Варя','*Улыбается*'),
 line('Варя','Да блин...'),
  cap('Группа начинает шуметь, в этот момент Владимир Иванович замечает прическу Тимохи и говорит.'),
  line('Владимир Иванович','Тим, ну сколько можно, ты когда челочку подравняешь?'),
line('Владимир Иванович','*Нахмурился*'),
  line('Владимир Иванович','Твоим друзьям уже сказали про такие прически...'),
  line('Владимир Иванович','А тебе как видишь еще нет'),
  line('Владимир Иванович','Задумайся'),
  line('Владимир Иванович','*Владимир Иванович ехидно улыбнулся*'),
  cap('Спустя время'),
  line('Владимир Иванович','Так а во сколько у нас пара то кончается'),
  line('Саша Раев','В 14:00'),
  line('Саша Раев','Ой а вы можете меня отпустить в 13:40 пораньше'),
  line('Владимир Иванович','Хорошо я тебя отпущу в 13:40, а группа уйдет вместе со мной 13:10'),
  cap('Группа смеется'),
  line('Владимир Иванович','*Владимир Иванович садится за стол*'),
  line('Владимир Иванович','Да кто там ноги пораставлял свои под моей партой а?'),
  line('Тимоха','Нооормально'),
  cap('Группа смеется'),
  cap('Конец пары')
 ],()=>{toast('Дзынь! Перемена',1900);setTimeout(()=>{changeScene('officeMsg',83,272);toast('Спустя некоторое время...',1800);setTimeout(()=>setChapter('Кабинет 407','Телефон на столе'),1850);},2050);});}
function messageScene(){pendingPhone=true;toast('Телефон завибрировал · новое сообщение',2400);}
function openMessage(){if(!pendingPhone)return;pendingPhone=false;visual('notification','НОВОЕ СООБЩЕНИЕ · MAX');tone(680,.08);setTimeout(()=>{visual('message','ПЕРЕПИСКА · ВАРЯ');talk([line('Варя','Владимир Иванович, у вас там пара следующая в 404, а я там флешку 2 пары назад ОПЯТЬ забыла, сможете посмотреть пожалуйста?')],()=>{talk([line('Владимир Иванович','По объявлению...')],()=>talk([line('Владимир Иванович','Хорошо.')],()=>{visual('reply','ОТВЕТ ОТПРАВЛЕН');setTimeout(()=>{hideVisual();route='404';changeScene('hall',85,270);setChapter('Коридор · кабинет 404','Найдите кабинет 404');},1100);}));});},900);}
function pickUp(){pickupUntil=clock+1.05;tone(720,.06);setTimeout(()=>{route='return';changeScene('hall',530,270);setChapter('Коридор · обратно','Вернитесь в кабинет 407');toast('Флешка найдена',1100);},900);}
function openComputer(){changeScene('desktop');visual('desktop','КОМПЬЮТЕР · WINDOWS 7',true);talk([line('Владимир Иванович','Так, где моя флешка.')],()=>{hideVisual();scene='explorer';visual('explorer','USB-НАКОПИТЕЛЬ (E:) · НАЙДЕНА ПАПКА',true);talk([line('Владимир Иванович','Ой блин, опять всё путаю, ну ладно, посмотрю что там у неё.')],()=>setChapter('Неизвестная флешка','Откройте папку «Любимому куратору»'));});}
function finale(){hideVisual();closeDialogue();scene='ending';gameOver=true;ui.hint.classList.remove('on');ui.stage.classList.add('ending-flash');setTimeout(()=>ui.stage.classList.remove('ending-flash'),700);const im=imgs.gift;if(im.complete&&im.naturalWidth)centerContain(im);confettiParts=Array.from({length:100},()=>({x:Math.random()*640,y:-Math.random()*360,v:35+Math.random()*100,c:['#ffe071','#ff7d9b','#76e4df','#faf2c8'][Math.floor(Math.random()*4)],s:2+Math.random()*3}));endingReady=true;ui.ending.hidden=false;ui.gameover.hidden=true;setChapter('С Днём СПО!','');tone(880,.12);setTimeout(()=>{if(scene!=='ending')return;ui.gameover.hidden=false;tone(587,.14);setTimeout(()=>tone(440,.5),170);},2700);}
function interact(){if(dialog){advance();tone(460,.035);return;}if(scene==='drive')return;if(scene==='explorer'){toast('Наведите мышку на папку «Любимому куратору», чтобы открыть её',2200);return;}if(scene==='desktop'){openComputer();return;}if(scene==='ending')return;const obj=object();if(!obj||Math.hypot(obj.x-player.x,obj.y-player.y)>obj.r)return;tone(540,.055);
 if(scene==='home'){toast('До скорого, квартира!',700);setTimeout(()=>{changeScene('street',104,277);setChapter('Улица · машина рядом','Подойдите к машине');},550);}
 else if(scene==='street'){scene='drive';drive={progress:0,speed:.45,x:320,y:279,traffic:[],spawn:.9,lastCrash:0,shake:0,fade:-1};setChapter('Дорога до МИФИ','↑ газ · ← → объезжайте машины');}
 else if(scene==='outside'){talk([line('Владимир Иванович','Ну, приехали.')],()=>{changeScene('lobby',88,273);setChapter('Первый этаж','Найдите проход в коридор');});}
 else if(scene==='lobby'){changeScene('hall',80,270);route='stairs';}
else if(scene==='hall'&&route==='stairs'){talk([line('Владимир Иванович','Четвёртый этаж. Кабинет 407.')],()=>changeScene('floor4',300,273));}
  else if(scene==='floor4'){enterRoom();}
  else if(scene==='officeMsg'){if(pendingPhone){toast('Нажмите ENTER, чтобы открыть сообщение',1600);return;}messageScene();}
 else if(scene==='hall'&&route==='404'){changeScene('room404',78,270);}
 else if(scene==='room404'){pickUp();}
 else if(scene==='hall'&&route==='return'){enterReturnOffice();}
 else if(scene==='officeReturn'){openComputer();}
}
function enterReturnOffice(){changeScene('officeReturn',90,270);setChapter('Кабинет 407','Подойдите к компьютеру');}
function reset(){scene='home';route='stairs';player={x:92,y:HOME_Y,face:1,dx:0,dy:0};keys.clear();closeDialogue();paused=false;gameOver=false;endingReady=false;pendingPhone=false;clearTimeout(hoverTimer);drive={progress:0,speed:0,x:320,y:278,traffic:[],spawn:0,lastCrash:0,shake:0,fade:-1};ui.pause.hidden=true;ui.ending.hidden=true;ui.gameover.hidden=true;hideVisual();setChapter('Квартира · 08:10','Подойдите к двери');}
function togglePause(){if(scene==='ending'&&endingReady)return;paused=!paused;ui.pause.hidden=!paused;if(paused)keys.clear();}
function keyName(e){if(e.code==='Space')return'Space';if(e.code==='Enter')return'Enter';if(e.code==='Escape')return'Escape';if(e.code==='ArrowUp')return'ArrowUp';if(e.code==='ArrowDown')return'ArrowDown';if(e.code==='ArrowLeft')return'ArrowLeft';if(e.code==='ArrowRight')return'ArrowRight';if(/^Key[WASD]$/.test(e.code))return e.code;return e.code;}
function openFolder(){if(scene!=='explorer'||dialog||paused)return;finale();tone(850,.1);}
window.addEventListener('keydown',e=>{const k=keyName(e);if(e.repeat&&['Enter','Space','KeyE','Escape'].includes(k))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyE'].includes(k))e.preventDefault();if(k==='Escape'){togglePause();return;}if(paused)return;if(['Enter','Space'].includes(k)){if(dialog)advance();else if(pendingPhone)openMessage();return;}if(k==='KeyE'){interact();return;}keys.add(k);});window.addEventListener('keyup',e=>keys.delete(keyName(e)));window.addEventListener('blur',()=>keys.clear());
 ui.dialogue.addEventListener('click',e=>{if(e.target.closest('button'))return;advance();});
 // Папка на флешке открывается наведением мыши: наведите курсор на «Любимому куратору».
 ui.stage.addEventListener('pointermove',e=>{clearTimeout(hoverTimer);if(scene!=='explorer'||dialog||paused)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*640/r.width,y=(e.clientY-r.top)*360/r.height;if(x>125&&x<405&&y>85&&y<150)hoverTimer=setTimeout(openFolder,380);});
 ui.stage.addEventListener('pointerleave',()=>clearTimeout(hoverTimer));
document.querySelector('#menuButton').addEventListener('click',togglePause);document.querySelector('#resumeButton').addEventListener('click',togglePause);document.querySelector('#restartButton').addEventListener('click',reset);document.querySelector('#againButton').addEventListener('click',reset);
function tick(now){const prev=clock;clock=now/1000;const dt=Math.min(clock-prev,.04)||1/60;let dx=0,dy=0;if(!paused&&!dialog&&scene!=='drive'&&scene!=='desktop'&&scene!=='explorer'&&scene!=='ending'){const b=bounds();if(keys.has('ArrowLeft')||keys.has('KeyA'))dx--;if(keys.has('ArrowRight')||keys.has('KeyD'))dx++;if(keys.has('ArrowUp')||keys.has('KeyW'))dy--;if(keys.has('ArrowDown')||keys.has('KeyS'))dy++;if(b.lock)dy=0;if(dx||dy){player.dy=dy;player.dx=dx;const n=Math.hypot(dx,dy)||1;player.x+=dx/n*105/60*dt*60;player.y+=dy/n*86/60*dt*60;player.x=Math.max(b.x0,Math.min(b.x1,player.x));player.y=b.lock?b.y:Math.max(b.y0,Math.min(b.y1,player.y));if(dx)player.face=Math.sign(dx);}}
    if (!dx && !dy) { player.dy = 0; player.dx = 0; } if (!paused) draw(); requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
reset();

setTimeout(() => {
    talk([line('Владимир Иванович', 'Так... Ну пора на работу')]);
}, 100);























