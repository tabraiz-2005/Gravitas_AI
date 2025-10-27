const chat = document.getElementById('chat');
const promptEl = document.getElementById('prompt');
const sendBtn = document.getElementById('send');
const modelSel = document.getElementById('model');
const newChatBtn = document.getElementById('newChatBtn');

let messages = [];

function addBubble(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${role}`;
    wrap.innerHTML = `
    <div class="role">${role === 'user' ? 'U' : 'G'}</div>
    <div class="bubble"></div>
  `;
    wrap.querySelector('.bubble').textContent = text;
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
    return wrap.querySelector('.bubble');
}

function sseToText(chunk) {
    // Split "data: ..." lines, join payloads
    return chunk.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.replace(/^data:\s?/, ''))
        .join('\n');
}

async function sendMessage() {
    const content = promptEl.value.trim();
    if (!content) return;

    // user bubble
    addBubble('user', content);
    messages.push({ role: 'user', content });

    // assistant bubble (stream target)
    const target = addBubble('assistant', '');

    promptEl.value = '';
    sendBtn.disabled = true;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model: modelSel.value || undefined })
        });

        if (!res.ok || !res.body) {
            target.textContent = '[Error] Failed to connect.';
            sendBtn.disabled = false;
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let assistantText = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const text = sseToText(chunk);
            if (text) {
                assistantText += text;
                target.textContent = assistantText;
            }
        }
        messages.push({ role: 'assistant', content: assistantText });
    } catch (e) {
        target.textContent = `[Error] ${e}`;
    } finally {
        sendBtn.disabled = false;
    }
}

sendBtn.addEventListener('click', sendMessage);
promptEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
newChatBtn.addEventListener('click', () => {
    messages = [];
    chat.innerHTML = '';
    promptEl.focus();
});
