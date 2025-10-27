const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = input.value.trim();
  if (!userText) return;

  appendMessage("user", userText);
  input.value = "";

  const response = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userText }),
  });

  const data = await response.json();
  appendStreamedMessage("bot", data.reply);
});

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add(sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendStreamedMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add(sender);
  chatBox.appendChild(msg);

  let i = 0;
  const typing = setInterval(() => {
    msg.textContent = text.slice(0, i);
    chatBox.scrollTop = chatBox.scrollHeight;
    i++;
    if (i > text.length) clearInterval(typing);
  }, 20);
}
