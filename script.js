import tmi from 'tmi.js';
import { MAX_MESSAGES } from './config.js';

const chatMessages = document.getElementById('chat-messages');
const channelInput = document.getElementById('channel-name');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');

let client = null;
let currentChannel = null;

// Function to add a message to the chat display
function addMessage(userstate, message) {
    const li = document.createElement('li');

    const metaSpan = document.createElement('span');
    metaSpan.classList.add('message-meta');
    metaSpan.textContent = `${userstate['display-name'] || 'System'}: `;
    if (userstate.color) {
        metaSpan.style.color = userstate.color;
    }


    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    contentSpan.textContent = message;

    li.appendChild(metaSpan);
    li.appendChild(contentSpan);

    chatMessages.appendChild(li);

    // Keep only the last MAX_MESSAGES messages
    if (chatMessages.children.length > MAX_MESSAGES) {
        chatMessages.removeChild(chatMessages.firstChild);
    }

    // Auto-scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to add a system message (e.g., connection status)
function addSystemMessage(message) {
    addMessage({}, `[${message}]`);
}


// Function to connect to a Twitch channel
function connectToChannel() {
    const channelName = channelInput.value.trim().toLowerCase();
    if (!channelName) {
        alert('Please enter a channel name.');
        return;
    }
    if (client && client.readyState() === 'OPEN') {
        addSystemMessage(`Already connected to #${currentChannel}. Disconnect first.`);
        return; // Don't reconnect if already connected
    }


    // Clear previous chat messages
    chatMessages.innerHTML = '';
    addSystemMessage(`Connecting to #${channelName}...`);

    client = new tmi.Client({
        options: { debug: false }, // Set to true for more logs
        connection: {
            secure: true,
            reconnect: true
        },
        channels: [channelName]
    });

    client.on('message', (channel, userstate, message, self) => {
        // Don't listen to my own messages
        if (self) return;
        addMessage(userstate, message);
    });

    client.on('connected', (address, port) => {
        addSystemMessage(`Successfully connected to #${channelName}`);
        currentChannel = channelName;
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-block';
        channelInput.disabled = true; // Disable input while connected
    });

    client.on('disconnected', (reason) => {
        addSystemMessage(`Disconnected from #${currentChannel}. Reason: ${reason || 'Unknown'}`);
        if (currentChannel === channelName){ //Only reset UI if it was the intended channel that disconnected
            resetUI();
        }
    });

    client.on('join', (channel, username, self) => {
         // Maybe add join messages later if desired
        // console.log(`${username} joined ${channel}`);
    });

    client.on('part', (channel, username, self) => {
        // Maybe add part messages later if desired
        // console.log(`${username} left ${channel}`);
    });

     client.on('error', (err) => {
        console.error('TMI.js Error:', err);
        addSystemMessage(`Error connecting to #${channelName}. Check console.`);
        resetUI(); // Ensure UI resets on connection error
    });


    client.connect().catch(err => {
         console.error("Connection failed:", err);
         addSystemMessage(`Failed to connect to #${channelName}. Check channel name.`);
         resetUI();
    });
}


// Function to disconnect from the current channel
function disconnectFromChannel() {
    if (client && client.readyState() === 'OPEN') {
        addSystemMessage(`Disconnecting from #${currentChannel}...`);
        client.disconnect()
            .then(() => {
                 // addSystemMessage(`Successfully disconnected from #${currentChannel}.`); // Handled by 'disconnected' event
                 // resetUI(); // Handled by 'disconnected' event
            })
            .catch(err => {
                console.error("Disconnection error:", err);
                addSystemMessage(`Error disconnecting: ${err}`);
                 resetUI(); // Reset UI even if disconnect has error
            });
    } else {
         addSystemMessage("Not currently connected.");
         resetUI(); // Ensure UI is in disconnected state
    }
}

// Function to reset the UI to its initial state
function resetUI() {
    connectBtn.style.display = 'inline-block';
    disconnectBtn.style.display = 'none';
    channelInput.disabled = false;
    currentChannel = null;
    client = null; // Clear the client instance
}

// Event Listeners
connectBtn.addEventListener('click', connectToChannel);
disconnectBtn.addEventListener('click', disconnectFromChannel);
channelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        connectToChannel();
    }
});

// Initial state
disconnectBtn.style.display = 'none';


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
        metaSpan.textContent = `[System]: `;
    } else {
        metaSpan.textContent = `${displayName}: `;
        // Use Twitch color if available
        if (userstate.color) {
            metaSpan.style.color = userstate.color;
            li.style.borderLeftColor = userstate.color; // Add color accent to border
        } else {
             // Default color if none provided (useful for testing/edge cases)
            metaSpan.style.color = '#6441a5';
            li.style.borderLeftColor = '#6441a5';
        }
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
    addMessage({}, message, true); // Use the isSystem flag
}


// Function to connect to a Twitch channel
async function connectToChannel() {
    const channelName = channelInput.value.trim().toLowerCase();
    if (!channelName) {
        addSystemMessage('Please enter a channel name.');
        return;
    }
    // Prevent multiple connection attempts if already connecting or connected
    if (client && (client.readyState() === 'CONNECTING' || client.readyState() === 'OPEN')) {
        addSystemMessage(`Already connecting/connected to #${currentChannel || channelName}. Disconnect first.`);
        return;
    }


    // Clear previous chat messages
    chatMessages.innerHTML = '';
    addSystemMessage(`Connecting to #${channelName}...`);
    setConnectingState(true); // Update UI to show connecting state


    client = new tmi.Client({
        options: { debug: false }, // Set to true for more logs in console
        connection: {
            secure: true,
            reconnect: true // tmi.js handles basic reconnect logic
        },
        // Identity is optional for read-only view
        // identity: { username: 'your_username', password: 'oauth:your_oauth_token' }, // Not needed for read-only
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
        if (currentChannel === channelName || !currentChannel) {
             addSystemMessage(`Disconnected from #${channelName}. ${reason ? `Reason: ${reason}` : ''}`);
             resetUI();
        } else {
            // If disconnected from a different channel (shouldn't happen with this setup, but good practice)
            addSystemMessage(`Unexpected disconnect event. Current: ${currentChannel}, Disconnected: ${channelName}`);
        }

    });

    // Optional: More event listeners for richer feedback
    // client.on('join', (channel, username, self) => { ... });
    // client.on('part', (channel, username, self) => { ... });
    client.on('connecting', (address, port) => {
        console.log(`TMI: Connecting to ${address}:${port}`);
         // Handled by initial addSystemMessage and setConnectingState
    });
     client.on('reconnect', () => {
        addSystemMessage(`Attempting to reconnect to #${currentChannel || channelName}...`);
        setConnectingState(true); // Show reconnecting state
    });


    try {
         await client.connect();
         // Success is handled by the 'connected' event listener
    } catch (err) {
        console.error('TMI.js Connection Error:', err);
        addSystemMessage(`Failed to connect to #${channelName}. Check channel name or network status.`);
        resetUI(); // Reset UI on connection failure
    }
}


// Function to disconnect from the current channel
async function disconnectFromChannel() {
    if (client && client.readyState() === 'OPEN') {
        addSystemMessage(`Disconnecting from #${currentChannel}...`);
        try {
            await client.disconnect();
            // Success is handled by the 'disconnected' event listener
            // Resetting UI is also handled there.
        } catch (err) {
             console.error("TMI.js Disconnection error:", err);
             addSystemMessage(`Error during disconnection: ${err}`);
             resetUI(); // Force UI reset on disconnect error
        }
    } else {
         addSystemMessage("Not currently connected.");
         resetUI(); // Ensure UI is in disconnected state if logic gets here unexpectedly
    }
}

// --- UI State Management Functions ---

function setConnectingState(isConnecting) {
     connectBtn.disabled = isConnecting;
     connectBtn.textContent = isConnecting ? 'Connecting...' : 'Connect';
     disconnectBtn.disabled = isConnecting;
     channelInput.disabled = isConnecting;
}

function setConnectedState(isConnected) {
    connectBtn.style.display = isConnected ? 'none' : 'inline-block';
    connectBtn.disabled = false; // Re-enable connect button if we disconnect
    connectBtn.textContent = 'Connect'; // Reset button text

    disconnectBtn.style.display = isConnected ? 'inline-block' : 'none';
    disconnectBtn.disabled = !isConnected;

    channelInput.disabled = isConnected; // Disable input only when fully connected
}


// Function to reset the UI to its initial disconnected state
function resetUI() {
    setConnectedState(false); // Set UI to disconnected state
    setConnectingState(false); // Ensure connecting state is also reset
    currentChannel = null;
    // Don't clear chat on disconnect, just reset buttons/input
    client = null; // Clear the client instance reference
}

// --- Event Listeners Setup ---
connectBtn.addEventListener('click', connectToChannel);
disconnectBtn.addEventListener('click', disconnectFromChannel);
channelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !channelInput.disabled) { // Only connect if input isn't disabled
        connectToChannel();
    }
});

// --- Initial State ---
resetUI(); // Set the initial UI state
addSystemMessage("Enter a Twitch channel name and click 'Connect'.");


