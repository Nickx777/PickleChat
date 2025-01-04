class ChatApp {
    constructor() {
        this.conversations = JSON.parse(localStorage.getItem('conversations')) || [];
        this.currentConversationId = null;
        this.isInCallMode = false;
        this.callTimer = null;

        // DOM elements
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

        // For Markdown
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

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (this.isInCallMode) {
                    this.processVoiceCall(transcript);
                } else {
                    this.chatInput.value = transcript;
                    this.handleSendMessage();
                }
            };

            this.recognition.onend = () => {
                if (this.isInCallMode) {
                    this.recognition.start();
                } else {
                    this.voiceBtn.classList.remove('recording');
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.voiceBtn.classList.remove('recording');
            };

            this.voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
            this.endCallBtn.addEventListener('click', () => this.endVoiceCall());
        } else {
            this.voiceBtn.style.display = 'none';
            console.warn('Speech recognition not supported');
        }

        // Speech Synthesis
        this.synth = window.speechSynthesis;
        this.speaking = false;

        // Listeners
        this.chatInput.addEventListener('input', () => this.autoResizeInput());
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        this.newChatBtn.addEventListener('click', () => this.createNewConversation());
        this.deleteAllBtn.addEventListener('click', () => this.deleteAllChats());

        // Init
        this.initializeApp();
    }

    // Start/Stop voice call
    toggleVoiceInput() {
        if (this.voiceBtn.classList.contains('recording')) {
            this.endVoiceCall();
        } else {
            this.startVoiceCall();
        }
    }
    startVoiceCall() {
        this.isInCallMode = true;
        this.recognition.start();
        this.voiceBtn.classList.add('recording');
        this.phoneSimulator.classList.add('active');
        
        let seconds = 0;
        this.callTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            this.phoneTimer.textContent = 
              `${String(minutes).padStart(2,'0')}:${String(remainingSeconds).padStart(2,'0')}`;
        },1000);
    }
    endVoiceCall() {
        this.isInCallMode = false;
        this.recognition.stop();
        this.voiceBtn.classList.remove('recording');
        this.phoneSimulator.classList.remove('active');
        if (this.speaking) {
            this.synth.cancel();
            this.speaking = false;
        }
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        const msg = document.createElement('div');
        msg.className = 'message system';
        msg.textContent = '*Voice chat ended*';
        this.chatDisplay.appendChild(msg);
        this.chatDisplay.scrollTop = this.chatDisplay.scrollHeight;
    }

    async processVoiceCall(transcript) {
        try {
            // Show user transcript in chat (but not saving it in conversation)
            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'message user';
            userMsgDiv.innerHTML = transcript;
            this.chatDisplay.appendChild(userMsgDiv);

            // Build minimal array for call mode
            const msgs = [
                { role: "system", content: "You are Pickle, a helpful phone assistant. Keep replies concise." },
                { role: "user", content: transcript }
            ];

            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sk-ef6e72c13b734499a91f5847a258e4e3'
                },
                body: JSON.stringify({
                    messages: msgs,
                    model: "deepseek-chat"
                })
            });

            const data = await response.json();
            const botReply = data.choices[0].message.content;

            // Show bot reply (not saved to conversation)
            const botMsgDiv = document.createElement('div');
            botMsgDiv.className = 'message bot';
            botMsgDiv.innerHTML = botReply;
            this.chatDisplay.appendChild(botMsgDiv);
            this.chatDisplay.scrollTop = this.chatDisplay.scrollHeight;

            // Speak if still in call
            if (this.isInCallMode) {
                this.speakText(botReply);
            }
        } catch (error) {
            console.error('Error:',error);
            this.speakText('Sorry, I had an error. Please try again.');
        }
    }

    speakText(text) {
        if (this.isInCallMode) {
            this.recognition.stop();
        }
        const cleaned = text
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\[.*?\]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]|[\u{23F3}]|[\u{24C2}]|[\u{23E9}-\u{23EF}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{0023}-\u{0039}]\u{20E3}/gu,
          ''
        ).trim();
        if (this.speaking) {
            this.synth.cancel();
        }
        const utter = new SpeechSynthesisUtterance(cleaned);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        utter.onend = () => {
            this.speaking = false;
            if (this.isInCallMode) {
                this.recognition.start();
            }
        };
        utter.onerror = (e) => {
            console.error('TTS error:',e);
            this.speaking = false;
        };
        this.speaking = true;
        this.synth.speak(utter);
    }

    autoResizeInput() {
        this.chatInput.style.height='auto';
        if (this.chatInput.scrollHeight<150) {
            this.chatInput.style.height=this.chatInput.scrollHeight+'px';
        } else {
            this.chatInput.style.height='150px';
        }
    }

    // Stream text for typing effect
    async streamText(text, element) {
        let currentText = '';
        const words=text.split(' ');
        for(let word of words) {
            currentText+=word+' ';
            element.innerHTML=marked.parse(currentText);
            await new Promise(r=>setTimeout(r,50));
        }
        return currentText;
    }

    deleteAllChats() {
        if(confirm('Are you sure you want to delete all chats?')) {
            this.conversations=[];
            this.saveConversations();
            this.currentConversationId=null;
            this.renderConversationsList();
            this.showWelcomeMessage();
        }
    }

    showWelcomeMessage() {
        this.chatDisplay.innerHTML=`
          <div class="welcome-message">
            <i class="fas fa-comments" style="font-size:48px;"></i>
            <p>Create a chat to get started</p>
          </div>
        `;
    }

    initializeApp() {
        this.renderConversationsList();
        if(!this.conversations.length) {
            this.showWelcomeMessage();
        } else {
            this.loadConversation(this.conversations[0].id);
        }
    }

    createNewConversation() {
        const convo = {
            id:Date.now().toString(),
            title:'New Chat',
            messages:[]
        };
        this.conversations.unshift(convo);
        this.saveConversations();
        this.renderConversationsList();
        this.loadConversation(convo.id);
    }

    loadConversation(convoId) {
        this.currentConversationId=convoId;
        this.chatDisplay.innerHTML='';
        const c = this.conversations.find(cc=>cc.id===convoId);
        if(c) {
            c.messages.forEach(msg=>{
                this.displayMessage(msg.role,msg.content,false);
            });
        }
        // highlight active
        document.querySelectorAll('.conversation-item').forEach(item=>{
            item.classList.toggle('active',item.dataset.id===convoId);
        });
        this.chatDisplay.scrollTop=this.chatDisplay.scrollHeight;
    }

    async handleSendMessage() {
        const msg=this.chatInput.value.trim();
        if(!msg) return;
        if(this.isInCallMode) return;

        if(!this.currentConversationId) {
            const convo={
                id:Date.now().toString(),
                title:'New Chat',
                messages:[]
            };
            this.conversations.unshift(convo);
            this.currentConversationId=convo.id;
            this.saveConversations();
            this.renderConversationsList();
        }

        this.chatInput.value='';
        this.chatInput.style.height='auto';
        this.displayMessage('User', msg, true);

        try{
            const conversation=this.conversations.find(c=>c.id===this.currentConversationId);
            // Count how many user messages exist in this conversation
            const userCount=conversation.messages.filter(m=>m.role==='User').length;

            // If it's the 3rd user message, generate a short title
            // using the entire conversation as context
            if(userCount===3) {
                // Build messages array with entire conversation so far
                // Convert our conversation messages to the roles used by the API
                const allContext = conversation.messages.map(m => {
                    return {
                        role: m.role.toLowerCase()==='bot' ? 'assistant' : 'user',
                        content: m.content
                    };
                });

                // We'll prepend a system instruction that says:
                // "Generate a short title for the entire conversation so far..."
                const titleRequest = [
                    {
                        role: "system",
                        content: "Generate a very short title (4 words or fewer) summarizing the entire conversation so far. Output only the title text, nothing else."
                    },
                    // Append all conversation so far for context
                    ...allContext
                ];

                const titleResponse = await fetch('https://api.deepseek.com/chat/completions', {
                    method:'POST',
                    headers:{
                        'Content-Type':'application/json',
                        'Authorization':'Bearer sk-ef6e72c13b734499a91f5847a258e4e3'
                    },
                    body:JSON.stringify({
                        messages:titleRequest,
                        model:"deepseek-chat"
                    })
                });
                const titleData=await titleResponse.json();
                let shortTitle=titleData.choices[0].message.content
                  .replace(/\r?\n|\r/g,' ')
                  .trim()
                  .substring(0,20);
                if(titleData.choices[0].message.content.length>20){
                    shortTitle+='...';
                }
                conversation.title=shortTitle;
                this.saveConversations();
                this.renderConversationsList();
            }

            // Now build the request for the main AI response
            const fullMessages=[
                {
                    role:"system",
                    content:"You are Pickle, a helpful assistant. Maintain context of the conversation and refer to previous messages if relevant."
                }
            ];
            // Add all messages so far
            conversation.messages.forEach(m=>{
                fullMessages.push({
                    role: m.role.toLowerCase()==='bot' ? 'assistant' : 'user',
                    content: m.content
                });
            });

            const response=await fetch('https://api.deepseek.com/chat/completions',{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'Authorization':'Bearer sk-ef6e72c13b734499a91f5847a258e4e3'
                },
                body:JSON.stringify({
                    messages:fullMessages,
                    model:"deepseek-chat"
                })
            });
            const data=await response.json();
            const botReply=data.choices[0].message.content;

            // Show bot typing
            const messageElement=document.createElement('div');
            messageElement.classList.add('message','bot','typing');
            messageElement.setAttribute('data-sender','Pickle');

            const contentDiv=document.createElement('div');
            contentDiv.className='message-content';
            messageElement.appendChild(contentDiv);
            this.chatDisplay.appendChild(messageElement);

            await this.streamText(botReply,contentDiv);
            messageElement.classList.remove('typing');

            // Save final bot message
            conversation.messages.push({ role:'Bot', content:botReply });
            this.saveConversations();
            this.renderConversationsList();

        }catch(err){
            console.error('Error:',err);
            this.displayMessage('Bot','Sorry, I encountered an error. Please try again.',true);
        }
    }

    displayMessage(role, content, save=true){
        const messageElement=document.createElement('div');
        messageElement.classList.add('message',role.toLowerCase());
        let senderName='System';
        if(role==='Bot')senderName='Pickle';
        if(role==='User')senderName='You';
        messageElement.setAttribute('data-sender', senderName);

        const contentDiv=document.createElement('div');
        contentDiv.className='message-content';
        if(role==='Bot'){
            contentDiv.innerHTML=marked.parse(content);
        } else {
            contentDiv.textContent=content;
        }
        messageElement.appendChild(contentDiv);
        this.chatDisplay.appendChild(messageElement);
        this.chatDisplay.scrollTop=this.chatDisplay.scrollHeight;

        if(save){
            const conversation=this.conversations.find(c=>c.id===this.currentConversationId);
            if(conversation){
                conversation.messages.push({role, content});
                this.saveConversations();
                this.renderConversationsList();
            }
        }
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
              </div>`;
            return;
        }
        this.conversations.forEach(convo=>{
            const conversationElement=document.createElement('div');
            conversationElement.className='conversation-item';
            conversationElement.dataset.id=convo.id;
            if(convo.id===this.currentConversationId){
                conversationElement.classList.add('active');
            }

            const contentDiv=document.createElement('div');
            contentDiv.className='conversation-content';
            let lastPreview='New conversation';
            if(convo.messages.length>0){
                const last=convo.messages[convo.messages.length-1];
                lastPreview=(last.role==='Bot'?'Pickle: ':'You: ')+ last.content.substring(0,50) + '...';
            }

            contentDiv.innerHTML=`
              <div class="conversation-title">${convo.title}</div>
              <div class="conversation-preview">${lastPreview}</div>
            `;

            const deleteButton=document.createElement('button');
            deleteButton.className='delete-chat-btn';
            deleteButton.title='Delete Chat';
            deleteButton.innerHTML='<i class="fas fa-trash"></i>';

            conversationElement.addEventListener('click',(e)=>{
                if(!e.target.closest('.delete-chat-btn')){
                    this.loadConversation(convo.id);
                }
            });
            deleteButton.onclick=(e)=>{
                e.preventDefault();
                e.stopPropagation();
                if(confirm('Are you sure you want to delete this conversation?')){
                    this.conversations=this.conversations.filter(c=>c.id!==convo.id);
                    this.saveConversations();
                    if(convo.id===this.currentConversationId){
                        if(this.conversations.length>0){
                            this.loadConversation(this.conversations[0].id);
                        }else{
                            this.showWelcomeMessage();
                            this.currentConversationId=null;
                        }
                    }
                    this.renderConversationsList();
                }
            };
            conversationElement.appendChild(contentDiv);
            conversationElement.appendChild(deleteButton);
            this.conversationsList.appendChild(conversationElement);
        });
    }

    saveConversations(){
        localStorage.setItem('conversations',JSON.stringify(this.conversations));
    }
}

document.addEventListener('DOMContentLoaded',()=>{
    new ChatApp();
});
