import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes("PASTE_");
let supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentUser = null, profile = null, activeFriend = null, messageChannel = null, presenceChannel = null, authMode = "login";
let friendProfiles = [];

function say(id, msg, error=false){ const el=$(id); if(el){el.textContent=msg;el.style.color=error?"#ff8b83":"#5cb3ff";} }
function initials(name){return (name||"M").trim().slice(0,1).toUpperCase();}
function setConnection(msg){$("connection").textContent=msg;}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
  authMode=b.dataset.tab; document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll(".signup-only").forEach(x=>x.classList.toggle("hidden",authMode!=="signup"));
  $("authSubmit").textContent=authMode==="login"?"Masuk ke Universe":"Buat akun";
}));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!supabase){say("authMessage","Isi Project URL dan Publishable/anon key di config.js dulu.",true);return;}
  const email=$("email").value.trim(), password=$("password").value, username=$("username").value.trim();
  $("authSubmit").disabled=true;
  try{
    if(authMode==="signup"){
      if(!username){say("authMessage","Username wajib diisi.",true);return;}
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username}}}); if(error)throw error;
      if(data.session){await ensureProfile(data.user,username);await startApp(data.user);}
      else say("authMessage","Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.");
    }else{
      const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await startApp(data.user);
    }
  }catch(err){say("authMessage",err.message||"Terjadi kesalahan.",true);}
  finally{$("authSubmit").disabled=false;}
});
async function ensureProfile(user,username){
  const {data}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
  if(!data){const {error}=await supabase.from("profiles").insert({id:user.id,username:username||user.user_metadata?.username||user.email.split("@")[0],bio:""});if(error)throw error;}
}
async function startApp(user){
  currentUser=user; await ensureProfile(user,user.user_metadata?.username);
  const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(error)throw error;profile=data;
  $("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("topSignup").classList.add("hidden");
  $("myName").textContent=profile.username;$("welcomeName").textContent=profile.username;$("myEmail").textContent=user.email;
  $("avatar").textContent=initials(profile.username);$("profileAvatar").textContent=initials(profile.username);
  $("profileUsername").value=profile.username;$("profileBio").value=profile.bio||"";
  setConnection("Terhubung · "+user.email);
  await loadFriends(); startPresence();
}
supabase?.auth.getSession().then(async({data})=>{if(data.session)try{await startApp(data.session.user)}catch(e){setConnection("Gagal memuat profil: "+e.message)}});
supabase?.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){location.reload();}});
$("logoutBtn").onclick=async()=>{if(supabase)await supabase.auth.signOut();};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$("page-"+b.dataset.page).classList.remove("hidden");if(b.dataset.page==="friends")loadFriends();if(b.dataset.page==="chat")renderChatFriends();});

async function loadFriends(){
  if(!supabase||!currentUser)return;
  const {data:rels,error}=await supabase.from("friendships").select("*").or(`requester.eq.${currentUser.id},addressee.eq.${currentUser.id}`);
  if(error){$("friendsList").innerHTML=`<small>${escapeHTML(error.message)}</small>`;return;}
  const accepted=(rels||[]).filter(r=>r.status==="accepted"), incoming=(rels||[]).filter(r=>r.status==="pending"&&r.addressee===currentUser.id);
  const ids=accepted.map(r=>r.requester===currentUser.id?r.addressee:r.requester);
  const allIds=[...new Set([...ids,...incoming.map(r=>r.requester)])];
  let profs=[];if(allIds.length){const res=await supabase.from("profiles").select("*").in("id",allIds);profs=res.data||[];}
  friendProfiles=profs.filter(p=>ids.includes(p.id));
  $("friendCount").textContent=friendProfiles.length+" teman";
  $("friendsList").innerHTML=friendProfiles.length?friendProfiles.map(p=>personHTML(p,"Teman",`<button class="secondary chat-open" data-id="${p.id}" data-name="${escapeHTML(p.username)}">Chat</button>`)).join(""):"<small>Belum ada teman. Cari pemain dari Beranda.</small>";
  $("incoming").innerHTML=incoming.length?incoming.map(r=>{const p=profs.find(x=>x.id===r.requester);return p?personHTML(p,"Ingin berteman",`<button class="primary accept" data-id="${p.id}">Terima</button>`):""}).join(""):"<small>Tidak ada permintaan masuk.</small>";
  $("friendsList").querySelectorAll(".chat-open").forEach(b=>b.onclick=()=>openChat(b.dataset.id,b.dataset.name));
  $("incoming").querySelectorAll(".accept").forEach(b=>b.onclick=()=>acceptFriend(b.dataset.id));
  renderChatFriends();
}
function personHTML(p,sub,action=""){return `<div class="person"><div class="avatar">${escapeHTML(initials(p.username))}</div><div class="person-info"><b>${escapeHTML(p.username)}</b><small>${escapeHTML(sub)}</small></div>${action}</div>`;}
async function acceptFriend(id){const {error}=await supabase.from("friendships").update({status:"accepted"}).eq("requester",id).eq("addressee",currentUser.id);if(error)alert(error.message);else loadFriends();}
$("discoverBtn").onclick=async()=>{
  const q=$("discoverSearch").value.trim();if(!q)return;
  const {data,error}=await supabase.from("profiles").select("id,username,bio").ilike("username",`%${q}%`).neq("id",currentUser.id).limit(10);
  if(error){$("discoverResults").textContent=error.message;return;}
  if(!data.length){$("discoverResults").innerHTML="<small>Pemain tidak ditemukan.</small>";return;}
  const {data:rels}=await supabase.from("friendships").select("*").or(`requester.eq.${currentUser.id},addressee.eq.${currentUser.id}`);
  $("discoverResults").innerHTML=data.map(p=>{const rel=(rels||[]).find(r=>(r.requester===p.id&&r.addressee===currentUser.id)||(r.requester===currentUser.id&&r.addressee===p.id));let act=rel?`<small>${rel.status==="accepted"?"Sudah berteman":"Permintaan terkirim/menunggu"}</small>`:`<button class="primary add-friend" data-id="${p.id}">Tambah</button>`;return personHTML(p,p.bio||"Pemain MDA",act)}).join("");
  $("discoverResults").querySelectorAll(".add-friend").forEach(b=>b.onclick=async()=>{const {error}=await supabase.from("friendships").insert({requester:currentUser.id,addressee:b.dataset.id,status:"pending"});if(error)alert(error.message);else{$("discoverBtn").click();}});
};
$("saveProfile").onclick=async()=>{const username=$("profileUsername").value.trim(),bio=$("profileBio").value.trim();if(!username)return say("profileMessage","Username tidak boleh kosong.",true);const {error}=await supabase.from("profiles").update({username,bio,updated_at:new Date().toISOString()}).eq("id",currentUser.id);if(error)return say("profileMessage",error.message,true);profile.username=username;profile.bio=bio;$("myName").textContent=username;$("welcomeName").textContent=username;$("avatar").textContent=initials(username);$("profileAvatar").textContent=initials(username);say("profileMessage","Profil berhasil disimpan.");};

function renderChatFriends(){$("chatFriends").innerHTML=friendProfiles.length?friendProfiles.map(p=>personHTML(p,"Teman",`<span>›</span>`).replace('class="person"','class="person chat-person" data-id="'+p.id+'" data-name="'+escapeHTML(p.username)+'"')).join(""):"<small>Tambahkan teman untuk mulai chat.</small>";$("chatFriends").querySelectorAll(".chat-person").forEach(el=>el.onclick=()=>openChat(el.dataset.id,el.dataset.name));}
async function openChat(friendId,name){
  activeFriend=friendId;$("chatTitle").textContent="Chat dengan "+name;$("chatInput").disabled=false;$("sendBtn").disabled=false;
  $("chatFriends").querySelectorAll(".person").forEach(x=>x.classList.toggle("selected",x.dataset.id===friendId));
  if(messageChannel)await supabase.removeChannel(messageChannel);
  await loadMessages();
  messageChannel=supabase.channel("chat-"+[currentUser.id,friendId].sort().join("-")).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},payload=>{const m=payload.new;if((m.sender_id===currentUser.id&&m.receiver_id===friendId)||(m.sender_id===friendId&&m.receiver_id===currentUser.id))appendMessage(m);}).subscribe();
}
async function loadMessages(){
  $("messages").innerHTML="";const a=currentUser.id,b=activeFriend;
  const {data,error}=await supabase.from("messages").select("*").or(`and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`).order("created_at",{ascending:true}).limit(100);
  if(error){$("messages").textContent=error.message;return;}(data||[]).forEach(appendMessage);
}
function appendMessage(m){if(document.querySelector(`[data-message="${m.id}"]`))return;const div=document.createElement("div");div.className="bubble"+(m.sender_id===currentUser.id?" mine":"");div.dataset.message=m.id;div.textContent=m.body;const small=document.createElement("small");small.textContent=new Date(m.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});div.appendChild(small);$("messages").appendChild(div);$("messages").scrollTop=$("messages").scrollHeight;}
$("sendForm").onsubmit=async e=>{e.preventDefault();const body=$("chatInput").value.trim();if(!body||!activeFriend)return;const {error}=await supabase.from("messages").insert({sender_id:currentUser.id,receiver_id:activeFriend,body});if(error)alert(error.message);else $("chatInput").value="";};
function startPresence(){if(!supabase)return;presenceChannel=supabase.channel("online-users",{config:{presence:{key:currentUser.id}}});presenceChannel.on("presence",{event:"sync"},()=>{}).subscribe(async status=>{if(status==="SUBSCRIBED")await presenceChannel.track({username:profile.username,online_at:new Date().toISOString()});});window.addEventListener("beforeunload",()=>presenceChannel?.untrack());}

// Offline puzzle
let tiles=[1,2,3,4,5,6,7,8,0],steps=0;
function drawPuzzle(){const root=$("puzzle");root.innerHTML="";tiles.forEach((n,i)=>{const b=document.createElement("button");b.className="tile"+(!n?" empty":"");b.textContent=n||"";b.disabled=!n;b.onclick=()=>moveTile(i);root.appendChild(b);});$("puzzleStatus").textContent="Langkah: "+steps+(tiles.join("")==="123456780"?" · Selesai!":"");}
function moveTile(i){const z=tiles.indexOf(0);if([z-3,z+3,z-1,z+1].includes(i)&&!(Math.abs(i-z)===1&&Math.floor(i/3)!==Math.floor(z/3))){[tiles[i],tiles[z]]=[tiles[z],tiles[i]];steps++;drawPuzzle();}}
function shuffle(){tiles=[1,2,3,4,5,6,7,8,0];for(let i=0;i<120;i++){const z=tiles.indexOf(0),opts=[z-3,z+3,z-1,z+1].filter(j=>j>=0&&j<9&&!(Math.abs(j-z)===1&&Math.floor(j/3)!==Math.floor(z/3)));const j=opts[Math.floor(Math.random()*opts.length)];[tiles[z],tiles[j]]=[tiles[j],tiles[z]];}steps=0;drawPuzzle();}
$("shufflePuzzle").onclick=shuffle;drawPuzzle();
let raceTimer=null,raceCount=0,raceEnd=0;
$("raceStart").onclick=()=>{clearInterval(raceTimer);raceCount=0;raceEnd=Date.now()+10000;$("raceTap").disabled=false;$("raceStart").disabled=true;$("raceScore").textContent="0";$("raceStatus").textContent="Balapan dimulai!";raceTimer=setInterval(()=>{if(Date.now()>=raceEnd){clearInterval(raceTimer);$("raceTap").disabled=true;$("raceStart").disabled=false;$("raceStatus").textContent=`Selesai! Kamu mendapat ${raceCount} poin.`;}},100);};
$("raceTap").onclick=()=>{if(Date.now()<raceEnd){raceCount++;$("raceScore").textContent=raceCount;$("raceCar").style.left=Math.min(82,raceCount*2)+"%";}};
if(!configured){setConnection("Perlu konfigurasi Supabase");say("authMessage","Sebelum digunakan, isi config.js dengan Project URL dan Publishable/anon key dari Supabase.");}

$("topSignup").onclick=()=>$("suUser").focus();
let secret=Math.ceil(Math.random()*100),tries=0;
$("guessBtn").onclick=()=>{const g=+$("guessIn").value;if(!g)return;tries++;if(g===secret){$("guessStatus").textContent=`Benar! ${tries} kali tebak. Angka baru dipilih.`;secret=Math.ceil(Math.random()*100);tries=0;}else $("guessStatus").textContent=g<secret?"Terlalu kecil":"Terlalu besar";$("guessIn").value="";};
const pl=[];let cur=-1;
$("musicFiles").onchange=e=>{[...e.target.files].forEach(f=>pl.push({name:f.name,url:URL.createObjectURL(f)}));if(cur<0&&pl.length)play(0);else drawPl();};
function drawPl(){$("playlist").innerHTML=pl.map((t,i)=>`<div class="person${i===cur?" selected":""}" data-i="${i}" style="cursor:pointer"><div class="avatar">♪</div><div class="person-info"><b>${escapeHTML(t.name)}</b></div></div>`).join("")||"<small>Belum ada lagu.</small>";$("playlist").querySelectorAll(".person").forEach(el=>el.onclick=()=>play(+el.dataset.i));}
function play(i){cur=i;$("player").src=pl[i].url;$("player").play();drawPl();}
$("player").onended=()=>{if(cur+1<pl.length)play(cur+1);};
drawPl();

function relay(mode,e,a,b){e.preventDefault();authMode=mode;$("email").value=$(a).value.trim();$("password").value=$(b).value;$("username").value=mode==="signup"?$("suUser").value.trim():"";$("authForm").requestSubmit();}
$("loginForm").onsubmit=e=>relay("login",e,"liEmail","liPass");
$("signupForm").onsubmit=e=>{if($("suPass").value!==$("suPass2").value){e.preventDefault();say("authMessage","Konfirmasi password tidak sama.",true);return;}relay("signup",e,"suEmail","suPass");};
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>document.querySelector('.nav[data-page="'+b.dataset.go+'"]').click());

$("topSearch").onkeydown=e=>{if(e.key!=="Enter")return;document.querySelector('.nav[data-page="home"]').click();$("discoverSearch").value=$("topSearch").value;$("discoverBtn").click();$("discoverResults").scrollIntoView({behavior:"smooth"});};
let did=false;setInterval(()=>{if(!currentUser)return;if(!did){did=true;loadFriends();}$("statusList").innerHTML=friendProfiles.slice(0,5).map(p=>personHTML(p,"Teman","")).join("")||"<small>Belum ada teman.</small>";},3000);
let tb=Array(9).fill(""),tend=false;const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const twin=b=>{for(const[a,c,d]of L)if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(x=>x)?"-":"";};
function tdraw(){$("ttt").innerHTML=tb.map((v,i)=>`<button data-i="${i}">${v}</button>`).join("");$("ttt").querySelectorAll("button").forEach(b=>b.onclick=()=>tmove(+b.dataset.i));}
function tmove(i){if(tend||tb[i])return;tb[i]="X";let w=twin(tb);if(!w){const e=tb.map((v,k)=>v?-1:k).filter(k=>k>=0);tb[e[Math.floor(Math.random()*e.length)]]="O";w=twin(tb);}tdraw();if(w){tend=true;$("tttStatus").textContent=w==="X"?"Kamu menang!":w==="O"?"Bot menang.":"Seri.";}}
$("tttReset").onclick=()=>{tb=Array(9).fill("");tend=false;$("tttStatus").textContent="Kamu X, giliranmu.";tdraw();};tdraw();
let mc=[],mf=[],mo=[],mm=0;
function mset(){const s=["★","♥","♪","☀","☾","✿"];mc=[...s,...s].sort(()=>Math.random()-.5);mf=[];mo=[];mm=0;mdraw();$("memStatus").textContent="Cocokkan semua pasangan.";}
function mdraw(){$("mem").innerHTML=mc.map((v,i)=>`<button data-i="${i}">${mf.includes(i)||mo.includes(i)?v:""}</button>`).join("");$("mem").querySelectorAll("button").forEach(b=>b.onclick=()=>mflip(+b.dataset.i));}
function mflip(i){if(mo.length===2||mo.includes(i)||mf.includes(i))return;mo.push(i);mdraw();if(mo.length===2){mm++;if(mc[mo[0]]===mc[mo[1]]){mf.push(...mo);mo=[];mdraw();if(mf.length===12)$("memStatus").textContent=`Selesai dalam ${mm} langkah!`;}else setTimeout(()=>{mo=[];mdraw();},700);}}
$("memReset").onclick=mset;mset();
