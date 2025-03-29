import tmi from 'tmi.js';
import { MAX_MESSAGES } from './config.js';

const chatMessages = document.getElementById('chat-messages');
const channelInput = document.getElementById('channel-name');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');

let client = null;
let currentChannel = null;

// Function to add a message to the chat display
function addMessage(userstate, message, isSystem = false) {
    const li = document.createElement('li');

    // Sanitize display name and message content (basic example)
    const sanitize = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    const displayName = sanitize(userstate['display-name'] || 'System');
    const messageContent = sanitize(message);

    const metaSpan = document.createElement('span');
    metaSpan.classList.add('message-meta');

    if (isSystem) {
        li.classList.add('system-message');
        li.style.borderLeftColor = '#888'; // Distinct border for system messages
        metaSpan.textContent = `[System]: `;
        metaSpan.style.color = '#555'; // System message meta color
    } else {
        metaSpan.textContent = `${displayName}: `;
        // Use Twitch color if available, fallback to a default
        const userColor = userstate.color || '#6441a5'; // Default purple if no color
        metaSpan.style.color = userColor;
        li.style.borderLeftColor = userColor; // Add color accent to border
    }

    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    // Basic link detection (replace simple URLs with clickable links)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    contentSpan.innerHTML = messageContent.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');


    li.appendChild(metaSpan);
    li.appendChild(contentSpan);

    chatMessages.appendChild(li);

    // Keep only the last MAX_MESSAGES messages
    while (chatMessages.children.length > MAX_MESSAGES) {
        chatMessages.removeChild(chatMessages.firstChild);
    }

    // Auto-scroll to the bottom only if the user is already near the bottom
    const isScrolledToBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 30; // Add buffer
    if (isScrolledToBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Function to add a system message (e.g., connection status)
function addSystemMessage(message) {
    console.info(`[System Message] ${message}`); // Log system messages to console too
    addMessage({}, message, true); // Use the isSystem flag
}


// Function to connect to a Twitch channel
async function connectToChannel() {
    console.log("Connect button clicked or Enter pressed."); // Check if function is called
    const channelName = channelInput.value.trim().toLowerCase();
    if (!channelName) {
        addSystemMessage('Please enter a channel name.');
        return;
    }
    // Prevent multiple connection attempts if already connecting or connected
    if (client && (client.readyState() === 'CONNECTING' || client.readyState() === 'OPEN')) {
         addSystemMessage(`Already connecting/connected to #${currentChannel || channelName}. Disconnect first.`);
        console.warn("Connection attempt blocked: Already connecting or connected.");
        return;
    }


    // Clear previous chat messages
    chatMessages.innerHTML = '';
    addSystemMessage(`Attempting to connect to #${channelName}...`);
    setConnectingState(true); // Update UI to show connecting state


    client = new tmi.Client({
        options: { debug: true }, // *** ENABLED DEBUG LOGS ***
        connection: {
            secure: true,
            reconnect: true // tmi.js handles basic reconnect logic
        },
        // Identity is optional for read-only view
        channels: [channelName]
    });

    // --- Event Listeners ---
    client.on('message', (channel, userstate, message, self) => {
        // Don't listen to my own messages (if identity was provided)
        if (self) return;
        addMessage(userstate, message);
    });

    client.on('connected', (address, port) => {
        addSystemMessage(`Successfully connected to #${channelName}`);
        currentChannel = channelName;
        setConnectedState(true);
    });

    client.on('disconnected', (reason) => {
        // Only show message and reset if it was the channel we intended to connect to
        // or if we never fully connected (currentChannel is null)
        if (currentChannel === channelName || !currentChannel) {
             addSystemMessage(`Disconnected from #${currentChannel || channelName}. ${reason ? `Reason: ${reason}` : '(No reason provided)'}`);
             resetUI();
        } else {
            // If disconnected from a different channel (shouldn't happen with this setup)
             addSystemMessage(`Unexpected disconnect event from a different channel. Current: ${currentChannel}, Disconnected channel event: ${channelName}`);
             // Don't reset UI automatically in this odd case, might still be connected to currentChannel
        }

    });

    // Optional: More event listeners for richer feedback
    client.on('connecting', (address, port) => {
        console.log(`TMI: Connecting event to ${address}:${port}`);
         // Handled by initial addSystemMessage and setConnectingState
    });
     client.on('reconnect', () => {
        addSystemMessage(`Attempting to reconnect to #${currentChannel || channelName}...`);
        setConnectingState(true); // Show reconnecting state
    });


    try {
         console.log("Calling client.connect()...");
         await client.connect();
         console.log("client.connect() promise resolved (connection likely established, waiting for 'connected' event).");
         // Success is handled by the 'connected' event listener
    } catch (err) {
        console.error('TMI.js Connection Error:', err);
        // Check if the error object has more details
        let errorMsg = `Failed to connect to #${channelName}.`;
        if (err && err.message) {
             errorMsg += ` Error: ${err.message}`;
        } else if (typeof err === 'string') {
            errorMsg += ` Error: ${err}`;
        } else {
            errorMsg += ' Check console for details.'
        }
        addSystemMessage(errorMsg);
        resetUI(); // Reset UI on connection failure
    }
}


// Function to disconnect from the current channel
async function disconnectFromChannel() {
    console.log("Disconnect button clicked.");
    if (client && client.readyState() === 'OPEN') {
        addSystemMessage(`Disconnecting from #${currentChannel}...`);
        setConnectingState(true); // Show a "disconnecting" state visually
        disconnectBtn.textContent = 'Disconnecting...';
        try {
            await client.disconnect();
            console.log("client.disconnect() promise resolved.");
            // Success is handled by the 'disconnected' event listener
            // Resetting UI is also handled there.
        } catch (err) {
             console.error("TMI.js Disconnection error:", err);
             addSystemMessage(`Error during disconnection: ${err.message || err}`);
             resetUI(); // Force UI reset on disconnect error
        }
    } else if (client && client.readyState() === 'CONNECTING') {
         addSystemMessage("Cannot disconnect while still connecting. Please wait.");
    }
    else {
         addSystemMessage("Not currently connected or connecting.");
         resetUI(); // Ensure UI is in disconnected state if logic gets here unexpectedly
    }
}

// --- UI State Management Functions ---

function setConnectingState(isConnecting) {
     connectBtn.disabled = isConnecting;
     connectBtn.textContent = isConnecting ? 'Connecting...' : 'Connect';
     // Also disable disconnect button during the initial connection attempt
     disconnectBtn.disabled = isConnecting || !currentChannel; // Disable if connecting OR not yet connected
     channelInput.disabled = isConnecting || !!currentChannel; // Disable if connecting OR already connected
}

function setConnectedState(isConnected) {
    connectBtn.style.display = isConnected ? 'none' : 'inline-block';
    connectBtn.disabled = false; // Re-enable connect button if we disconnect
    connectBtn.textContent = 'Connect'; // Reset button text

    disconnectBtn.style.display = isConnected ? 'inline-block' : 'none';
    disconnectBtn.disabled = !isConnected;
    disconnectBtn.textContent = 'Disconnect'; // Reset button text

    channelInput.disabled = isConnected; // Disable input only when fully connected
}


// Function to reset the UI to its initial disconnected state
function resetUI() {
    console.log("Resetting UI to disconnected state.");
    setConnectedState(false); // Set UI to disconnected state visuals
    setConnectingState(false); // Ensure connecting state visuals/disables are also reset
    currentChannel = null;
    client = null; // Clear the client instance reference
    disconnectBtn.textContent = 'Disconnect'; // Ensure button text is reset
    // Optional: Clear chat on disconnect? Current behaviour preserves it.
    // chatMessages.innerHTML = '';
}

// --- Event Listeners Setup ---
connectBtn.addEventListener('click', connectToChannel);
disconnectBtn.addEventListener('click', disconnectFromChannel);
channelInput.addEventListener('keypress', (e) => {
    // Check if connectBtn is visible and enabled before allowing Enter key connection
    if (e.key === 'Enter' && connectBtn.style.display !== 'none' && !connectBtn.disabled) {
        connectToChannel();
    }
});

// --- Initial State ---
resetUI(); // Set the initial UI state
addSystemMessage("Enter a Twitch channel name and click 'Connect'.");