class ChatApp {
    constructor() {
        // text-based conversations
        this.conversations = JSON.parse(localStorage.getItem('conversations')) || [];
        this.currentConversationId = null;

        // phone call tracking
        this.isInCallMode = false;
        this.callTimer = null;
        this.callHistory = [];
        this.currentCall = [];

        // DOM
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.deleteAllBtn = document.getElementById('delete-all-btn');
        this.conversationsList = document.getElementById('conversations-list');
        this.chatDisplay = document.getElementById('chat-display');
        this.voiceBtn = document.getElementById('voice-btn');
        this.phoneSimulator = document.querySelector('.phone-simulator');
        this.endCallBtn = document.querySelector('.end-call-btn');
        this.phoneTimer = document.querySelector('.phone-timer');

        // Marked config
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });

        // Speech Recognition
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (evt) => {
                const transcript = evt.results[0][0].transcript;
                if(this.isInCallMode){
                    // phone call logic
                    this.processVoiceCall(transcript);
                } else {
                    // normal text
                    this.chatInput.value = transcript;
                    this.handleSendMessage();
                }
            };
            this.recognition.onend=()=>{
                if(this.isInCallMode){
                    this.recognition.start();
                } else{
                    this.voiceBtn.classList.remove('recording');
                }
            };
            this.recognition.onerror=(err)=>{
                console.error('SpeechRec error:',err.error);
                this.voiceBtn.classList.remove('recording');
            };

            this.voiceBtn.addEventListener('click', ()=>this.toggleCall());
            this.endCallBtn.addEventListener('click', ()=>this.endVoiceCall());
        } else {
            this.voiceBtn.style.display='none';
            console.warn('No speech recognition supported');
        }

        // TTS
        this.synth=window.speechSynthesis;
        this.speaking=false;

        // events
        this.chatInput.addEventListener('input', ()=>this.autoResizeInput());
        this.sendButton.addEventListener('click', ()=>this.handleSendMessage());
        this.chatInput.addEventListener('keypress',(e)=>{
            if(e.key==='Enter' && !e.shiftKey){
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        this.newChatBtn.addEventListener('click',()=>this.createNewConversation());
        this.deleteAllBtn.addEventListener('click',()=>this.deleteAllChats());

        // init
        this.initializeApp();
    }

    // =====================
    // VOICE CALL
    // =====================
    toggleCall(){
        if(this.voiceBtn.classList.contains('recording')){
            this.endVoiceCall();
        } else{
            this.startVoiceCall();
        }
    }
    startVoiceCall(){
        this.isInCallMode=true;
        this.currentCall=[];

        this.recognition.start();
        this.voiceBtn.classList.add('recording');
        this.phoneSimulator.classList.add('active');

        let secs=0;
        this.callTimer=setInterval(()=>{
            secs++;
            const mm=Math.floor(secs/60);
            const ss=secs%60;
            this.phoneTimer.textContent=`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        },1000);
    }
    endVoiceCall(){
        this.isInCallMode=false;
        this.recognition.stop();
        this.voiceBtn.classList.remove('recording');
        this.phoneSimulator.classList.remove('active');

        if(this.speaking){
            this.synth.cancel();
            this.speaking=false;
        }
        if(this.callTimer){
            clearInterval(this.callTimer);
            this.callTimer=null;
        }

        // system message
        const sys=document.createElement('div');
        sys.classList.add('message','system');
        sys.textContent='*Voice chat ended*';
        this.chatDisplay.appendChild(sys);

        const index=this.callHistory.length;
        this.callHistory.push(this.currentCall);

        // show transcript
        const showBtn=document.createElement('button');
        showBtn.textContent='Show Transcript';
        showBtn.className='transcript-toggle-btn';

        const transcriptDiv=document.createElement('div');
        transcriptDiv.className='transcript-container';

        let lines='';
        this.currentCall.forEach(pair=>{
            lines+=`You: ${pair.user}\nPickle: ${pair.bot}\n\n`;
        });
        transcriptDiv.textContent=lines.trim();

        let visible=false;
        showBtn.onclick=()=>{
            visible=!visible;
            transcriptDiv.style.display=visible?'block':'none';
            showBtn.textContent=visible?'Hide Transcript':'Show Transcript';
        };

        this.chatDisplay.appendChild(showBtn);
        this.chatDisplay.appendChild(transcriptDiv);
        this.chatDisplay.scrollTop=this.chatDisplay.scrollHeight;
    }
    async processVoiceCall(userSpeech){
        try{
            const callMsgs=[
                { role:'system', content:"You are Pickle, a phone assistant. Keep replies short and do not display them in the main chat." },
                { role:'user', content:userSpeech }
            ];
            const resp=await fetch('https://api.deepseek.com/chat/completions',{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'Authorization':'Bearer sk-ef6e72c13b734499a91f5847a258e4e3'
                },
                body:JSON.stringify({
                    messages:callMsgs,
                    model:"deepseek-chat"
                })
            });
            const data=await resp.json();
            const botLine=data.choices[0].message.content;

            this.currentCall.push({
                user:userSpeech,
                bot:botLine
            });
            if(this.isInCallMode){
                this.speakText(botLine);
            }
        } catch(e){
            console.error('Voice call error:',e);
            this.speakText('Error happened. Try again.');
        }
    }
    speakText(text){
        if(this.isInCallMode){
            this.recognition.stop();
        }
        const cleaned=text
          .replace(/\*\*(.*?)\*\*/g,'$1')
          .replace(/\[.*?\]/g,'')
          .replace(/\(.*?\)/g,'')
          .replace(
            /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]|[\u{23F3}]|[\u{24C2}]|[\u{23E9}-\u{23EF}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{0023}-\u{0039}]\u{20E3}/gu,
            ''
          ).trim();
        if(this.speaking){
            this.synth.cancel();
        }
        const utter=new SpeechSynthesisUtterance(cleaned);
        utter.rate=1.0;
        utter.pitch=1.0;
        utter.volume=1.0;
        utter.onend=()=>{
            this.speaking=false;
            if(this.isInCallMode){
                this.recognition.start();
            }
        };
        utter.onerror=(err)=>{
            console.error('TTS error:',err);
            this.speaking=false;
        };
        this.speaking=true;
        this.synth.speak(utter);
    }

    // =====================
    //  TEXT CHAT
    // =====================
    autoResizeInput(){
        this.chatInput.style.height='auto';
        if(this.chatInput.scrollHeight<150){
            this.chatInput.style.height=this.chatInput.scrollHeight+'px';
        } else{
            this.chatInput.style.height='150px';
        }
    }
    async streamText(text, el){
        let current='';
        const words=text.split(' ');
        for(const w of words){
            current+=w+' ';
            el.innerHTML=marked.parse(current);
            await new Promise(r=>setTimeout(r,50));
        }
        return current;
    }
    displayMessage(role, content, save=true){
        const msg=document.createElement('div');
        msg.classList.add('message', role.toLowerCase());
        let sender='System';
        if(role==='User')sender='You';
        else if(role==='Bot')sender='Pickle';
        msg.setAttribute('data-sender',sender);

        const cd=document.createElement('div');
        cd.className='message-content';
        if(role==='Bot'){
            cd.innerHTML=marked.parse(content);
        } else {
            cd.textContent=content;
        }
        msg.appendChild(cd);
        this.chatDisplay.appendChild(msg);
        this.chatDisplay.scrollTop=this.chatDisplay.scrollHeight;

        if(save){
            const conv=this.conversations.find(cc=>cc.id===this.currentConversationId);
            if(conv){
                conv.messages.push({role, content});
                this.saveConversations();
                this.renderConversationsList();
            }
        }
    }

    async handleSendMessage(){
        const userMsg=this.chatInput.value.trim();
        if(!userMsg)return;
        if(this.isInCallMode)return;

        if(!this.currentConversationId){
            const c={
                id:Date.now().toString(),
                title:'New Chat',
                messages:[]
            };
            this.conversations.unshift(c);
            this.currentConversationId=c.id;
            this.saveConversations();
            this.renderConversationsList();
        }

        this.chatInput.value='';
        this.chatInput.style.height='auto';
        this.displayMessage('User',userMsg,true);

        try{
            const conversation=this.conversations.find(cc=>cc.id===this.currentConversationId);
            // how many user messages exist
            const userCount=conversation.messages.filter(m=>m.role==='User').length;

            // 3rd user message => short summary
            if(userCount===3){
                // build entire text conversation
                const context=conversation.messages.map(m=>{
                    return {
                        role:m.role.toLowerCase()==='bot'?'assistant':'user',
                        content:m.content
                    };
                });
                const titlePrompt=[
                    {
                        role:'system',
                        content:"Produce a 2 - 1 word summary of the entire conversation so far. do not copy any user or assistant line. Return only the short summary, nothing else. and do not use **test** to try make the title bold"
                    },
                    ...context
                ];
                const titleResp=await fetch('https://api.deepseek.com/chat/completions',{
                    method:'POST',
                    headers:{
                        'Content-Type':'application/json',
                        'Authorization':'Bearer sk-ef6e72c13b734499a91f5847a258e4e3'
                    },
                    body:JSON.stringify({
                        messages:titlePrompt,
                        model:"deepseek-chat",
                        temperature:1.2,       // more creativity
                        presence_penalty:1.0,  // penalize repeating lines
                        max_tokens:20
                    })
                });
                const tData=await titleResp.json();
                let raw=tData.choices[0].message.content.trim();
                // just in case, keep it within 20 chars
                let shortTitle=raw.substring(0,20);
                if(raw.length>20) shortTitle+='...';
                conversation.title=shortTitle;
                this.saveConversations();
                this.renderConversationsList();
            }

            // normal AI reply with entire conversation so far
            const fullContext=[
                { role:'system', content:"You are Pickle, a helpful text assistant. Use the entire conversation so far to provide context." }
            ];
            conversation.messages.forEach(m=>{
                fullContext.push({
                    role:m.role.toLowerCase()==='bot'?'assistant':'user',
                    content:m.content
                });
            });

            const resp=await fetch('https://api.deepseek.com/chat/completions',{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'Authorization':'Bearer sk-ef6e72c13b734499a91f5847a258e4e3'
                },
                body:JSON.stringify({
                    messages:fullContext,
                    model:"deepseek-chat"
                })
            });
            const data=await resp.json();
            const botReply=data.choices[0].message.content;

            // "typing"
            const botMsg=document.createElement('div');
            botMsg.classList.add('message','bot','typing');
            botMsg.setAttribute('data-sender','Pickle');

            const cDiv=document.createElement('div');
            cDiv.className='message-content';
            botMsg.appendChild(cDiv);
            this.chatDisplay.appendChild(botMsg);

            await this.streamText(botReply,cDiv);
            botMsg.classList.remove('typing');

            // save
            conversation.messages.push({role:'Bot', content:botReply});
            this.saveConversations();
            this.renderConversationsList();

        } catch(e){
            console.error('Send message error:',e);
            this.displayMessage('Bot','Sorry, something went wrong.',true);
        }
    }

    // ================
    // SIDEBAR + ETC
    // ================
    createNewConversation(){
        const c={
            id:Date.now().toString(),
            title:'New Chat',
            messages:[]
        };
        this.conversations.unshift(c);
        this.saveConversations();
        this.renderConversationsList();
        this.loadConversation(c.id);
    }
    loadConversation(id){
        this.currentConversationId=id;
        this.chatDisplay.innerHTML='';
        const c=this.conversations.find(cc=>cc.id===id);
        if(c){
            c.messages.forEach(m=>{
                this.displayMessage(m.role,m.content,false);
            });
            this.chatDisplay.scrollTop=this.chatDisplay.scrollHeight;
        }
        document.querySelectorAll('.conversation-item').forEach(item=>{
            item.classList.toggle('active', item.dataset.id===id);
        });
    }
    deleteAllChats(){
        if(confirm('Are you sure you want to delete all chats?')){
            this.conversations=[];
            this.saveConversations();
            this.currentConversationId=null;
            this.renderConversationsList();
            this.showWelcomeMessage();
        }
    }
    showWelcomeMessage(){
        this.chatDisplay.innerHTML=`
          <div class="welcome-message">
            <i class="fas fa-comments" style="font-size:48px;"></i>
            <p>Create a chat to get started</p>
          </div>
        `;
    }
    renderConversationsList(){
        this.conversationsList.innerHTML='';
        if(!this.conversations.length){
            this.conversationsList.innerHTML=`
              <div class="conversation-item" style="cursor:default;opacity:0.5;">
                <div class="conversation-content">
                  <div class="conversation-title">No chats yet</div>
                  <div class="conversation-preview">Click the + button to start</div>
                </div>
              </div>
            `;
            return;
        }
        this.conversations.forEach(conv=>{
            const item=document.createElement('div');
            item.className='conversation-item';
            item.dataset.id=conv.id;
            if(conv.id===this.currentConversationId){
                item.classList.add('active');
            }

            const cdiv=document.createElement('div');
            cdiv.className='conversation-content';

            let preview='New conversation';
            if(conv.messages.length>0){
                const last=conv.messages[conv.messages.length-1];
                preview=(last.role==='Bot'?'Pickle: ':'You: ')+ last.content.substring(0,50)+'...';
            }
            cdiv.innerHTML=`
              <div class="conversation-title">${conv.title}</div>
              <div class="conversation-preview">${preview}</div>
            `;

            const delBtn=document.createElement('button');
            delBtn.className='delete-chat-btn';
            delBtn.title='Delete Chat';
            delBtn.innerHTML='<i class="fas fa-trash"></i>';

            item.addEventListener('click',(e)=>{
                if(!e.target.closest('.delete-chat-btn')){
                    this.loadConversation(conv.id);
                }
            });
            delBtn.onclick=(e)=>{
                e.preventDefault();
                e.stopPropagation();
                if(confirm('Delete this chat?')){
                    this.conversations=this.conversations.filter(cc=>cc.id!==conv.id);
                    this.saveConversations();
                    if(conv.id===this.currentConversationId){
                        if(this.conversations.length){
                            this.loadConversation(this.conversations[0].id);
                        } else{
                            this.showWelcomeMessage();
                            this.currentConversationId=null;
                        }
                    }
                    this.renderConversationsList();
                }
            };

            item.appendChild(cdiv);
            item.appendChild(delBtn);
            this.conversationsList.appendChild(item);
        });
    }
    saveConversations(){
        localStorage.setItem('conversations', JSON.stringify(this.conversations));
    }
    initializeApp(){
        this.renderConversationsList();
        if(!this.conversations.length){
            this.showWelcomeMessage();
        } else {
            this.loadConversation(this.conversations[0].id);
        }
    }
}

// On DOM loaded
document.addEventListener('DOMContentLoaded',()=> {
    new ChatApp();
});
