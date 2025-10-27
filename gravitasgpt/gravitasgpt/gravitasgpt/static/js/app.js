document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const messagesContainer = document.getElementById('messages'); // Assuming you have a div with id="messages"
    const messageInput = document.getElementById('messageInput');   // Assuming input has id="messageInput"
    const sendButton = document.getElementById('sendButton');     // Assuming button has id="sendButton"
    const chatForm = document.getElementById('chatForm');       // Assuming your input and button are in a form with id="chatForm"

    // --- State ---
    let messageHistory = []; // Store the conversation history

    // --- Function to Add Message to UI ---
    function addMessageToUI(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');

        // Basic Markdown support (e.g., bold, italic) - you can enhance this
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formattedText = formattedText.replace(/\n/g, '<br>'); // Handle newlines

        messageDiv.innerHTML = formattedText;
        messagesContainer.appendChild(messageDiv);

        // Scroll to the bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // --- Function to Handle SSE Stream ---
    function handleChatStream(history) {
        addMessageToUI('bot', ''); // Add an empty bot message bubble to start filling

        const eventSource = new EventSource('/api/chat', {
            method: 'POST', // EventSource uses GET by default, need to specify POST via fetch/xhr if required by backend, but Flask's Response stream often works with GET too if payload isn't needed in body. **Correction**: EventSource *only* uses GET. We'll need to use fetch for POST and process the stream manually.
            headers: {
                'Content-Type': 'application/json',
                // Add any other headers if needed
            },
            body: JSON.stringify({ messages: history }) // Send history in the body
        });


        let lastBotMessageDiv = messagesContainer.querySelector('.bot-message:last-child');
        if (!lastBotMessageDiv) return; // Should not happen, but safety check

        eventSource.onmessage = function(event) {
            const data = event.data;
            if (data.startsWith("[Error]")) {
                lastBotMessageDiv.innerHTML += `<span style="color: #ff5555;">${data}</span>`; // Display error in red
                eventSource.close();
                return;
            }
             // Append streamed text to the last bot message bubble
             // Basic Markdown re-application needed here as well
            let currentHTML = lastBotMessageDiv.innerHTML;
            currentHTML += data;
            let formattedHTML = currentHTML.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedHTML = formattedHTML.replace(/\*(.*?)\*/g, '<em>$1</em>');
            formattedHTML = formattedHTML.replace(/\n/g, '<br>');
            lastBotMessageDiv.innerHTML = formattedHTML;

            // Keep scrolled to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        eventSource.onerror = function(error) {
            console.error("EventSource failed:", error);
            lastBotMessageDiv.innerHTML += `<br><span style="color: #ff5555;">[Stream Connection Error]</span>`;
            eventSource.close();
            // Optionally disable input or show a reconnect button
            sendButton.disabled = false;
             messageInput.disabled = false;
        };

        // Note: EventSource doesn't have an 'onclose' or 'onend' in the standard sense.
        // The Flask backend closing the stream will trigger 'onerror' or just stop sending messages.
    }


     // --- Corrected Function using Fetch for POST and Stream Processing ---
     async function handleChatStreamWithFetch(history) {
        addMessageToUI('bot', ''); // Add placeholder
        let lastBotMessageDiv = messagesContainer.querySelector('.bot-message:last-child');
        if (!lastBotMessageDiv) return;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: history })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process buffer line by line for SSE format ("data: ...\n\n")
                let lines = buffer.split('\n\n');
                buffer = lines.pop(); // Keep the last partial line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim(); // Remove "data: " prefix

                         if (data.startsWith("[Error]")) {
                            lastBotMessageDiv.innerHTML += `<span style="color: #ff5555;">${data}</span>`;
                            throw new Error("Backend Error Received"); // Stop processing
                         }

                        // Append data, reformatting as needed
                        let currentHTML = lastBotMessageDiv.innerHTML;
                        currentHTML += data;
                        let formattedHTML = currentHTML.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        formattedHTML = formattedHTML.replace(/\*(.*?)\*/g, '<em>$1</em>');
                        formattedHTML = formattedHTML.replace(/\n/g, '<br>');
                        lastBotMessageDiv.innerHTML = formattedHTML;

                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            }

        } catch (error) {
            console.error("Fetch stream failed:", error);
            if(lastBotMessageDiv){
                 lastBotMessageDiv.innerHTML += `<br><span style="color: #ff5555;">[Stream Connection Error]</span>`;
            } else {
                 addMessageToUI('bot', `<span style="color: #ff5555;">[Stream Connection Error]</span>`);
            }
        } finally {
            // Re-enable input after stream ends or errors
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
    }


    // --- Event Listener for Sending Message ---
    async function sendMessage(event) {
        event.preventDefault(); // Prevent default form submission

        const userText = messageInput.value.trim();
        if (!userText) return; // Don't send empty messages

        // Add user message to UI and history
        addMessageToUI('user', userText);
        messageHistory.push({ role: 'user', content: userText });

        // Clear input and disable while waiting for response
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;

        // Start processing the chat stream using Fetch
        await handleChatStreamWithFetch(messageHistory);

        // Note: Re-enabling is done in the finally block of handleChatStreamWithFetch
    }

    // Attach listener to form submission
    if (chatForm) {
        chatForm.addEventListener('submit', sendMessage);
    } else if (sendButton) {
        // Fallback if no form, attach to button click
        sendButton.addEventListener('click', (e) => sendMessage(e)); // Need event for preventDefault if it were a submit button outside a form
    }

     // Allow sending with Enter key in the input field
     if (messageInput) {
        messageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline
                e.preventDefault(); // Prevent newline in input
                if (!sendButton.disabled) { // Only send if not already waiting
                    sendMessage(new Event('submit', { cancelable: true })); // Simulate form submission
                }
            }
        });
    }

    // --- Initial Greeting or Setup (Optional) ---
    // addMessageToUI('bot', 'Welcome to GravitasGPT. How can I assist you today?');
    // You might fetch initial context or history here if needed
});
