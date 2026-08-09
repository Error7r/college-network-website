import { Application } from 'https://unpkg.com/@splinetool/runtime/build/runtime.js';
import Swup from 'https://unpkg.com/swup@4?module';

// --- HuggingFace AI Configuration ---
const HF_TOKEN = "YOUR_HF_TOKEN_HERE"; // REPLACE WITH YOUR TOKEN
const HF_MODEL = "Qwen/Qwen2.5-72B-Instruct";
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

const SYSTEM_INSTRUCTION = "You are Dr. Saif, a fun, super chill, and brilliant Computer Science lecturer from the University of Technology, Baghdad. Keep your answers super short and punchy (ideally one sentence) unless it's about coding or tech stuff, then feel free to geek out and explain things in detail. You're fluent in both Arabic and English. Your background: PhD in Computer Vision, MSc in Information Systems, and BSc in Data Security. Contact: s4ifbn@gmail.com, IG: @s4ifbn. Your vibe is friendly, inspiring, and anything but boring—talk like a cool mentor who loves tech!";

let chatHistory = [];

function addMessageToUI(role, text) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    const div = document.createElement('div');
    div.className = `chat-message ${role}-message`;

    const iconStr = role === 'user' ? '<i data-lucide="user"></i>' : '<i data-lucide="cpu"></i>';

    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.5); padding:10px; border-radius:5px; margin: 10px 0; overflow-x: auto;"><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(0,255,136,0.1); color:var(--accent); padding:2px 4px; border-radius:3px;">$1</code>');

    div.innerHTML = `
        <div class="message-avatar">
            ${iconStr}
        </div>
        <div class="message-content">
            ${formattedText}
        </div>
    `;

    chatWindow.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addTypingIndicator() {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return null;

    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-message ai-message';
    div.innerHTML = `
        <div class="message-avatar">
            <i data-lucide="cpu"></i>
        </div>
        <div class="message-content" style="display: flex; align-items: center; padding: 15px 20px;">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    chatWindow.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    chatWindow.scrollTop = chatWindow.scrollHeight;

    return id;
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

window.initAIChat = function () {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const chatWindow = document.getElementById('chat-window');

    if (!chatInput || !sendBtn || !chatWindow) return;

    // Initialize chat history with system instruction
    if (chatHistory.length === 0) {
        chatHistory = [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "assistant", content: "Yo! Dr. Saif here 🤙 How can I help you today?" }
        ];

        // Setup initial greeting if chat window is empty
        if (chatWindow.children.length === 0) {
            addMessageToUI('ai', "Yo! Dr. Saif here 🤙 How can I help you today?");
        }
    }

    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    const newChatInput = chatInput.cloneNode(true);
    chatInput.parentNode.replaceChild(newChatInput, chatInput);

    async function sendToHuggingFace(userText, maxRetries = 3) {
        // Add user message to history
        chatHistory.push({ role: "user", content: userText });

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(HF_API_URL, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${HF_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: HF_MODEL,
                        messages: chatHistory,
                        max_tokens: 1024,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const errMsg = errData.error || response.statusText;
                    if (response.status === 429 && attempt < maxRetries - 1) {
                        const waitSec = Math.pow(2, attempt + 1) * 5;
                        console.warn(`Rate limited, retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`);
                        await new Promise(r => setTimeout(r, waitSec * 1000));
                        continue;
                    }
                    throw new Error(`HuggingFace API Error (${response.status}): ${errMsg}`);
                }

                const data = await response.json();
                const aiResponse = data.choices[0].message.content;

                // Add assistant response to history for context
                chatHistory.push({ role: "assistant", content: aiResponse });

                return aiResponse;
            } catch (error) {
                if (attempt < maxRetries - 1 && error.message && error.message.includes('429')) {
                    const waitSec = Math.pow(2, attempt + 1) * 5;
                    console.warn(`Rate limited, retrying in ${waitSec}s...`);
                    await new Promise(r => setTimeout(r, waitSec * 1000));
                } else {
                    // Remove the user message from history on final failure
                    chatHistory.pop();
                    throw error;
                }
            }
        }
    }

    async function handleSend() {
        const text = newChatInput.value.trim();
        if (!text) return;

        newChatInput.value = '';
        addMessageToUI('user', text);
        const typingId = addTypingIndicator();

        try {
            const responseText = await sendToHuggingFace(text);
            removeTypingIndicator(typingId);
            addMessageToUI('ai', responseText);
        } catch (error) {
            console.error("AI Chat Error:", error);
            removeTypingIndicator(typingId);
            const isRateLimit = error.message && (error.message.includes('429') || error.message.toLowerCase().includes('rate'));
            if (isRateLimit) {
                addMessageToUI('ai', "⚠️ Rate limit hit. Chill for a sec and try again! 😅");
            } else {
                addMessageToUI('ai', "Oops, something went wrong on my end. Check your connection and try again! 🔌");
            }
        }
    }

    newSendBtn.addEventListener('click', handleSend);
    newChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });
};

// Clear legacy simulate pass
if (localStorage.getItem('testPassed') === 'true' && !localStorage.getItem('testScore')) {
    localStorage.removeItem('testPassed');
}

// Global Mobile Menu Listener
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.mobile-menu-btn');
    if (btn) {
        const nav = document.querySelector('nav');
        if (nav) nav.classList.toggle('mobile-open');
    }
});

function initPage() {
    lucide.createIcons();
    if (typeof window.initAIChat === 'function') window.initAIChat();

    // Cleaned up mobile menu logic (handled globally below)

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const magneticBtns = document.querySelectorAll('.btn-magnetic');
    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.5}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = `translate(0px, 0px)`;
        });
    });

    document.querySelectorAll('.card:not(#test-card):not(.chat-container)').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = `rotateX(0deg) rotateY(0deg) translateY(0)`;
        });
    });

    const canvas = document.getElementById('canvas3d');
    const preloader = document.getElementById('cyber-preloader');
    const termContainer = document.getElementById('terminal-text-container');

    // Terminal typing logic
    async function typeLines(lines) {
        if (!termContainer) return;
        termContainer.innerHTML = '';

        for (let i = 0; i < lines.length; i++) {
            const lineEl = document.createElement('div');
            lineEl.className = 'terminal-line';
            termContainer.appendChild(lineEl);

            let text = lines[i];
            for (let j = 0; j < text.length; j++) {
                lineEl.textContent += text[j];
                await new Promise(r => setTimeout(r, 15 + Math.random() * 30));
            }
            await new Promise(r => setTimeout(r, 300));
        }

        const cursor = document.createElement('span');
        cursor.className = 'terminal-cursor';
        termContainer.lastChild.appendChild(cursor);
    }

    function hidePreloader() {
        if (preloader && !preloader.classList.contains('fade-out')) {
            if (termContainer) {
                const finalLine = document.createElement('div');
                finalLine.className = 'terminal-line';
                finalLine.style.color = '#fff';
                finalLine.textContent = '> ACCESS GRANTED. WELCOME.';
                termContainer.appendChild(finalLine);
            }
            setTimeout(() => {
                preloader.classList.add('fade-out');
                document.body.classList.add('preloader-finished');
                setTimeout(() => {
                    if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
                }, 2000);
            }, 2000);
        }
    }

    if (canvas && !canvas.dataset.loaded) {
        canvas.dataset.loaded = "true";
        canvas.addEventListener('wheel', (e) => e.stopImmediatePropagation(), { passive: true });
        canvas.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.stopImmediatePropagation(); }, { passive: true });
        canvas.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.stopImmediatePropagation(); }, { passive: true });

        // Start terminal sequence
        if (preloader) {
            typeLines([
                "> INITIALIZING CNWD SECURE NETWORK...",
                "> BYPASSING FIREWALL...",
                "> DECRYPTING MAINFRAME ENCRYPTION KEYS...",
                "> RENDERING 3D NEURAL ENVIRONMENT..."
            ]);

            // Fallback just in case 3D model fails to load or takes longer than 8 seconds
            setTimeout(hidePreloader, 8000);
        }

        const app = new Application(canvas);
        app.load('https://prod.spline.design/04EbNOndEQ9R5MmS/scene.splinecode?v=' + Date.now()).then(() => {
            const hero3d = document.querySelector('.hero-3d');
            if (hero3d) hero3d.classList.add('loaded');

            // Hide preloader when 3D model finishes
            hidePreloader();
        });
    } else {
        // Not on index page or already loaded, hide immediately
        if (preloader) {
            preloader.style.display = 'none';
        }
        document.body.classList.add('preloader-finished');
    }

    const locationCanvas = document.getElementById('location-canvas3d');
    if (locationCanvas && !locationCanvas.dataset.loaded) {
        locationCanvas.dataset.loaded = "true";
        locationCanvas.addEventListener('wheel', (e) => e.stopImmediatePropagation(), { passive: true });
        locationCanvas.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.stopImmediatePropagation(); }, { passive: true });
        locationCanvas.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.stopImmediatePropagation(); }, { passive: true });

        const appLocation = new Application(locationCanvas);
        appLocation.load('https://prod.spline.design/bH375WgZXfezH9RL/scene.splinecode');
    }

    const outline = document.getElementById('cursor-outline');
    document.querySelectorAll('a, button, .card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (outline) {
                outline.style.width = '70px';
                outline.style.height = '70px';
                outline.style.backgroundColor = 'var(--accent-soft)';
                outline.style.border = 'none';
            }
        });
        el.addEventListener('mouseleave', () => {
            if (outline) {
                outline.style.width = '40px';
                outline.style.height = '40px';
                outline.style.backgroundColor = 'transparent';
                outline.style.border = '1.5px dashed var(--accent)';
            }
        });
    });
}

const dot = document.getElementById('cursor-dot');
const outline = document.getElementById('cursor-outline');
window.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;
    document.documentElement.style.setProperty('--m-x', `${clientX}px`);
    document.documentElement.style.setProperty('--m-y', `${clientY}px`);
    if (dot) dot.style.transform = `translate(${clientX - 4}px, ${clientY - 4}px)`;
    if (outline) {
        outline.animate({
            left: `${clientX - 20}px`,
            top: `${clientY - 20}px`
        }, { duration: 500, fill: "forwards" });
    }
});

window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

const swup = new Swup();
initPage();
swup.hooks.on('page:view', initPage);

// Global Modal Setup
function setupModal() {
    const modal = document.getElementById('registration-modal');
    const openBtns = document.querySelectorAll('.nav-register-btn');
    const closeOverlay = document.querySelector('.modal-overlay');

    if (!modal) return;

    // Using event delegation so buttons inside swup container survive transitions
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.nav-register-btn')) {
            e.preventDefault();

            // Registration Lock Logic
            if (localStorage.getItem('testPassed') !== 'true') {
                const testSection = document.getElementById('entrance-test');
                if (testSection) {
                    testSection.scrollIntoView({ behavior: 'smooth' });
                    const testCard = document.getElementById('test-card');
                    if (testCard) {
                        testCard.style.boxShadow = '0 0 40px rgba(255, 51, 102, 0.6)';
                        setTimeout(() => testCard.style.boxShadow = '', 1000);
                    }
                } else {
                    alert("You must pass the Entrance Test on the Home page before registering!");
                    if (typeof swup !== 'undefined') swup.navigate('index.html');
                }
                return;
            }

            const m = document.getElementById('registration-modal');
            if (m) m.classList.add('active');
        }
    });

    closeOverlay.addEventListener('click', (e) => {
        if (e.target === closeOverlay) {
            modal.classList.remove('active');
            const customSelect = document.querySelector('.custom-select');
            if (customSelect) customSelect.classList.remove('open');
        }
    });

    window.updateTestUI = function () {
        if (localStorage.getItem('testPassed') === 'true') {
            const card = document.getElementById('test-card');
            if (card) {
                card.classList.add('test-passed');
                card.style.borderColor = 'rgba(0, 255, 136, 0.6)';
            }
            const icon = document.getElementById('test-status-icon');
            if (icon) {
                icon.style.color = '#00ff88';
                icon.setAttribute('data-lucide', 'check-circle');
            }
            const text = document.getElementById('test-status-text');
            if (text) {
                text.innerHTML = 'Congratulations! You have passed the entrance test. You may now proceed to <a href="#" style="color:var(--accent); text-decoration:underline;" class="nav-register-btn">Register</a>.';
            }
            const quizContainer = document.getElementById('quiz-container');
            if (quizContainer) {
                const savedScore = localStorage.getItem('testScore');
                let scoreText = '';
                if (savedScore) {
                    scoreText = `You scored <strong style="color: #fff;">${savedScore}/10</strong>.`;
                }

                quizContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <i data-lucide="shield-check" style="color: #00ff88; width: 64px; height: 64px; margin-bottom: 20px;"></i>
                        <h3 style="color: #00ff88; margin-bottom: 10px; font-size: 24px;">Access Granted</h3>
                        <p style="color: var(--text-dim); font-size: 16px;">Your proficiency has been verified. ${scoreText}</p>
                    </div>
                `;
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    // Call on load to restore state
    window.updateTestUI();

    // Custom Dropdown Logic
    const customSelect = document.querySelector('.custom-select');
    const selectTrigger = document.querySelector('.select-trigger');
    const options = document.querySelectorAll('.custom-option');
    const hiddenInput = document.getElementById('location-input');

    if (selectTrigger) {
        selectTrigger.addEventListener('click', () => {
            customSelect.classList.toggle('open');
        });
    }

    options.forEach(option => {
        option.addEventListener('click', function () {
            const val = this.dataset.value;
            selectTrigger.querySelector('span').textContent = this.textContent;
            hiddenInput.value = val;
            customSelect.classList.remove('open');
        });
    });

    const form = document.getElementById('register-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            alert("Registration logic to be implemented!");
            modal.classList.remove('active');
        });
    }

    // Render lucide icons globally after injecting modal
    lucide.createIcons();
}
setupModal();

// Lectures Logic
const lectureData = [{ "level": 1, "semester": 1, "name": "Programming Fundamentals", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/oop-saif.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/programming-lab.pdf" }, { "level": 1, "semester": 1, "name": "Mathematics", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/Mathematics.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/programming-lab.pdf" }, { "level": 1, "semester": 1, "name": "Statistics and Probability", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/statistics.pdf", "lab": "N/A" }, { "level": 1, "semester": 1, "name": "Information Theory", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/Information-Theory.pdf", "lab": "N/A" }, { "level": 1, "semester": 1, "name": "Human Rights and Democracy", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/11/human-rights.pdf", "lab": "N/A" }, { "level": 1, "semester": 2, "name": "Structured Programming", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2024/12/structured-programming-2004.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/prog-lab2.pdf" }, { "level": 1, "semester": 2, "name": "Discrete Structures", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/discrete-structures-NW.pdf", "lab": "N/A" }, { "level": 1, "semester": 2, "name": "Computer Organization and Logic Design", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/logic-design.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/logic-design-lab.pdf" }, { "level": 1, "semester": 2, "name": "Coding Techniques", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/02/codingTechniques-NW.pdf", "lab": "N/A" }, { "level": 1, "semester": 2, "name": "Principles of Networks", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/Prinn-Networks-NW.pdf", "lab": "N/A" }, { "level": 2, "semester": 1, "name": "Object Oriented Programming", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/oop-saif.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/oop-lab2025.pdf" }, { "level": 2, "semester": 1, "name": "Data Structures", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/data-structure.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/data-structures-lab2.pdf" }, { "level": 2, "semester": 1, "name": "Numerical Analysis", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/numerical-analysis.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/numerical-analysis-lab.pdf" }, { "level": 2, "semester": 1, "name": "Communications", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/communications2.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/communications-lab.pdf" }, { "level": 2, "semester": 1, "name": "Network Protocols", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/network-protocols.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/nw-protocols-lab.pdf" }, { "level": 2, "semester": 1, "name": "Baath Crimes in Iraq", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/baath-crimes.pdf", "lab": "N/A" }, { "level": 2, "semester": 2, "name": "Database", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/database-MM.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/database-lab-MM.pdf" }, { "level": 2, "semester": 2, "name": "Microprocessors", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/02/microprocessors-NW.pdf.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/microprocessors-lab.pdf" }, { "level": 2, "semester": 2, "name": "Searching and Sorting Algorithms", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/sorting-searching-algorthims-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/sort-and-search-lab.pdf" }, { "level": 2, "semester": 2, "name": "Web Design", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/web-desing-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/web-design-lab-NW.pdf" }, { "level": 2, "semester": 2, "name": "Intelligent Search Techniques", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/IST-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/IST-Lab-NW.pdf" }, { "level": 2, "semester": 2, "name": "English Language", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/english-2nd-NW.pdf", "lab": "N/A" }, { "level": 2, "semester": 2, "name": "Arabic Language", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/arabic-NW.pdf", "lab": "N/A" }, { "level": 3, "semester": 1, "name": "Computer Architecture", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/computer-artchitecture.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/11/computer-artchitecturs-lab-v2.pdf" }, { "level": 3, "semester": 1, "name": "Computational Theory", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/computation-theory.pdf", "lab": "N/A" }, { "level": 3, "semester": 1, "name": "Networks Switching", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/12/network-switchin-v2.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/switching-lab.pdf" }, { "level": 3, "semester": 1, "name": "Networks Programming Principles", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/networks-programming-principles.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/network-prog1-lab.pdf" }, { "level": 3, "semester": 1, "name": "Digital Signal Processing", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/DSP.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/DSP-lab.pdf" }, { "level": 3, "semester": 1, "name": "English Language", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/english.pdf", "lab": "N/A" }, { "level": 3, "semester": 2, "name": "Web Development", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/WBDV-V3.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/WBDV-V3.pdf" }, { "level": 3, "semester": 2, "name": "Compiler Design", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/compiler-design-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/compilers-lab-NW.pdf" }, { "level": 3, "semester": 2, "name": "Soft Computing", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/soft_computing-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/soft_computing-lab-NW.pdf" }, { "level": 3, "semester": 2, "name": "Networks Applications Programming", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/02/Networks-Applications-Programming-NW-V1.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/Networks-Applications-Programming-lab.pdf" }, { "level": 3, "semester": 2, "name": "Networks Routing", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/Routing-V5.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/Routing-NW-Lab.pdf" }, { "level": 3, "semester": 2, "name": "Arabic Language", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/3rd-arabic-lang.pdf", "lab": "N/A" }, { "level": 4, "semester": 1, "name": "Networks Security 1", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/08/NetworkSecurity1.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/NetworkSecurity1Lab2.pdf" }, { "level": 4, "semester": 1, "name": "Multimedia 1", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/multimedia1.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/multimedia1-lab22.pdf" }, { "level": 4, "semester": 1, "name": "Wireless Networks Fundamentals", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/wireless-fundamentals.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/wireless-fundamentals-lab2.pdf" }, { "level": 4, "semester": 1, "name": "Operating Systems 1", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/OS1v2.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/OS1-lab.pdf" }, { "level": 4, "semester": 1, "name": "Networks Management 1", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/networks-management1.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/networks-management1-lab.pdf" }, { "level": 4, "semester": 1, "name": "Static Web Programming", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/static-web2.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2025/10/static-web-lab2.pdf" }, { "level": 4, "semester": 2, "name": "Multimedia 2", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/multimedia2-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/multimedia-lab-NW.pdf" }, { "level": 4, "semester": 2, "name": "Networks Management", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/networks-managemt2.pdf", "lab": "N/A" }, { "level": 4, "semester": 2, "name": "Networks Security 2", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/network-security-2.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/network-security-2-lab.pdf" }, { "level": 4, "semester": 2, "name": "Operating Systems 2", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/03/os2-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/02/os2-lab-NW.pdf" }, { "level": 4, "semester": 2, "name": "Wireless Techniques", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/wireless-tech.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/wireless-tech-lab.pdf" }, { "level": 4, "semester": 2, "name": "Dynamic Web Programming", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/01/dynamc-web-NW.pdf", "lab": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/web-prog-lab.pdf" }, { "level": 4, "semester": 2, "name": "English Language 4", "theory": "https://cs.uotechnology.edu.iq/wp-content/uploads/2026/04/english4-IS.pdf", "lab": "N/A" }];

function renderCourses(levelId) {
    const paneFirst = document.getElementById('overlay-pane-first');
    const paneSecond = document.getElementById('overlay-pane-second');

    paneFirst.innerHTML = '';
    paneSecond.innerHTML = '';

    paneFirst.style.overflowY = 'auto';
    paneFirst.style.padding = '40px 5%';
    paneFirst.style.alignItems = 'flex-start';

    paneSecond.style.overflowY = 'auto';
    paneSecond.style.padding = '40px 5%';
    paneSecond.style.alignItems = 'flex-start';

    const levelNum = parseInt(levelId.replace('Level ', ''));

    const s1Courses = lectureData.filter(c => c.level === levelNum && c.semester === 1);
    const s2Courses = lectureData.filter(c => c.level === levelNum && c.semester === 2);

    function buildGrid(courses) {
        if (courses.length === 0) return `<div style="text-align:center; width:100%; color:var(--text-dim); margin-top: 50px;"><i data-lucide="folder-open" style="width: 64px; height: 64px; opacity: 0.2; margin-bottom: 20px;"></i><p>No materials available for this semester yet.</p></div>`;

        let html = '<div class="lectures-grid">';
        courses.forEach(course => {
            const theoryBtn = course.theory !== 'N/A'
                ? `<a href="${course.theory}" class="lecture-btn" target="_blank"><i data-lucide="file-text"></i> Theory</a>`
                : `<div class="lecture-btn disabled"><i data-lucide="file-text"></i> Theory</div>`;

            const labBtn = course.lab !== 'N/A'
                ? `<a href="${course.lab}" class="lecture-btn" target="_blank"><i data-lucide="monitor"></i> Lab</a>`
                : `<div class="lecture-btn disabled"><i data-lucide="monitor"></i> Lab</div>`;

            html += `
                <div class="lecture-card">
                    <div class="lecture-info">
                        <div class="lecture-icon">
                            <i data-lucide="book"></i>
                        </div>
                        <h4 class="lecture-title">${course.name}</h4>
                    </div>
                    <div class="lecture-actions">
                        ${theoryBtn}
                        ${labBtn}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    paneFirst.innerHTML = buildGrid(s1Courses);
    paneSecond.innerHTML = buildGrid(s2Courses);

    try { if (window.lucide) window.lucide.createIcons(); } catch (e) { console.error("Lucide Error:", e); }
}

function initLecturesSystem() {
    const levelBoxes = document.querySelectorAll('.level-box');
    const overlay = document.getElementById('course-fullscreen-overlay');
    const closeBtn = document.getElementById('overlay-close-btn');
    const titleDisplay = document.getElementById('overlay-level-title');

    if (!overlay) return;

    document.querySelectorAll('.box-3d').forEach(box => {
        if (!box.querySelector('.box-3d-glow')) {
            const glow = document.createElement('div');
            glow.className = 'box-3d-glow';
            box.insertBefore(glow, box.firstChild);
        }

        box.addEventListener('mousemove', (e) => {
            const rect = box.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const glowEl = box.querySelector('.box-3d-glow');
            if (glowEl) {
                glowEl.style.setProperty('--x', `${x}px`);
                glowEl.style.setProperty('--y', `${y}px`);
            }

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;

            box.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });

        box.addEventListener('mouseleave', () => {
            box.style.transform = `rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        });
    });

    levelBoxes.forEach(box => {
        box.addEventListener('click', () => {

            try {
                if (titleDisplay) titleDisplay.textContent = box.dataset.level || "Level";
                renderCourses(box.dataset.level || "Level 1");
            } catch (e) {
                console.error("Error in renderCourses:", e);
            }

            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';


            const nav = document.querySelector('nav');
            if (nav) {
                nav.style.transition = 'opacity 0.3s, transform 0.3s';
                nav.style.opacity = '0';
                nav.style.transform = 'translateX(-50%) translateY(-100px)';
                setTimeout(() => nav.style.zIndex = '0', 300);
            }

            setTimeout(() => switchTab('first'), 50);
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';

            const nav = document.querySelector('nav');
            if (nav) {
                nav.style.zIndex = '1000';
                nav.style.opacity = '1';
                nav.style.transform = 'translateX(-50%) translateY(0)';
            }
        });
    }

    const tabs = overlay.querySelectorAll('.course-tab');
    const indicator = overlay.querySelector('.tab-indicator');
    const panes = overlay.querySelectorAll('.course-content-pane');

    function switchTab(courseId) {
        const targetTab = overlay.querySelector(`.course-tab[data-target="${courseId}"]`);
        if (!targetTab) return;

        tabs.forEach(t => {
            t.classList.remove('active');
            t.style.color = '#fff';
        });
        targetTab.classList.add('active');
        targetTab.style.color = 'var(--accent)';

        const tabRect = targetTab.getBoundingClientRect();
        const parentRect = targetTab.parentElement.getBoundingClientRect();
        if (indicator && tabRect.width > 0) {
            indicator.style.width = `${tabRect.width}px`;
            indicator.style.left = `${tabRect.left - parentRect.left}px`;
        }

        panes.forEach(p => p.style.display = 'none');
        const targetPane = overlay.querySelector(`#overlay-pane-${courseId}`);
        if (targetPane) {
            targetPane.style.display = 'flex';
            targetPane.style.opacity = '0';
            targetPane.style.animation = 'fadeInSlideUp 0.5s ease forwards';
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.target));
    });
}


initLecturesSystem();
if (typeof swup !== 'undefined') {
    swup.hooks.on('page:view', initLecturesSystem);
}

// --- ENTRANCE QUIZ LOGIC ---
const entranceQuestions = [
    { difficulty: "Very Easy", question: "Which HTML tag is used to create a hyperlink?", options: ["A) <link>", "B) <a>", "C) <href>", "D) <url>"], correctIndex: 1 },
    { difficulty: "Very Easy", question: "In CSS, which property is used to change the background color of an element?", options: ["A) color", "B) bg-color", "C) background-color", "D) fill-color"], correctIndex: 2 },
    { difficulty: "Easy", question: "What does the alt attribute in an <img> tag provide?", options: ["A) A link to an alternative image.", "B) A tooltip when you hover over the image.", "C) Text description for screen readers or if the image fails to load.", "D) The alignment of the image relative to text."], correctIndex: 2 },
    { difficulty: "Easy", question: "What will be the result of the following JavaScript expression? console.log(typeof NaN);", options: ["A) \"number\"", "B) \"NaN\"", "C) \"undefined\"", "D) \"null\""], correctIndex: 0 },
    { difficulty: "Middle", question: "If an element has width: 200px, padding: 20px, and border: 5px, and the box-sizing is set to content-box (default), what is the total rendered width of the element?", options: ["A) 200px", "B) 225px", "C) 240px", "D) 250px"], correctIndex: 3 },
    { difficulty: "Middle", question: "What is the primary difference between let and var in terms of scoping?", options: ["A) let is function-scoped; var is block-scoped.", "B) var is function-scoped; let is block-scoped.", "C) var does not allow hoisting; let does.", "D) let can be redeclared in the same scope; var cannot."], correctIndex: 1 },
    { difficulty: "Middle", question: "Which of the following best describes a \"Closure\" in JavaScript?", options: ["A) A function that has been minified and closed for editing.", "B) A function that has access to its own scope, the global scope, and the outer function's scope even after the outer function has returned.", "C) An object that prevents any new properties from being added.", "D) A method that closes a database connection automatically."], correctIndex: 1 },
    { difficulty: "Hard", question: "In the browser Event Loop, what is the correct order of execution for the following tasks once the current execution stack is empty?", options: ["A) Macrotasks -> Microtasks -> Rendering", "B) Microtasks -> Rendering -> Macrotasks", "C) Rendering -> Macrotasks -> Microtasks", "D) Macrotasks -> Rendering -> Microtasks"], correctIndex: 1 },
    { difficulty: "Hard", question: "Which HTTP method is used for a CORS \"Preflight\" request to determine if the actual request is safe to send?", options: ["A) HEAD", "B) POST", "C) OPTIONS", "D) CONNECT"], correctIndex: 2 },
    { difficulty: "EXTREMELY HARD", question: "Regarding the V8 JavaScript Engine, what are \"Hidden Classes\" (or Shapes) and how do they relate to Inline Caching (IC)?", options: ["A) They are classes used to hide private variables in ES6.", "B) They are internal structures V8 creates to track object shapes; adding properties in a different order creates different hidden classes, which can break Inline Caching optimizations.", "C) They are a way to store CSS classes in memory for faster DOM manipulation.", "D) They are the mechanism that handles Garbage Collection for objects that have no active references."], correctIndex: 1 }
];

let currentQuizIndex = 0;
let quizScore = 0;

document.body.addEventListener('click', (e) => {
    // START QUIZ
    if (e.target.closest('#start-quiz-btn')) {
        e.preventDefault();
        const intro = document.getElementById('quiz-intro');
        if (intro) intro.style.display = 'none';
        const ui = document.getElementById('quiz-ui');
        if (ui) ui.style.display = 'block';
        currentQuizIndex = 0;
        quizScore = 0;
        renderQuizQuestion();
    }

    // NEXT QUESTION
    if (e.target.closest('#quiz-next-btn')) {
        e.preventDefault();
        currentQuizIndex++;
        if (currentQuizIndex < entranceQuestions.length) {
            renderQuizQuestion();
        } else {
            finishQuiz();
        }
    }

    // OPTION CLICK
    const optionEl = e.target.closest('.quiz-option');
    if (optionEl && !optionEl.classList.contains('disabled')) {
        e.preventDefault();
        const selectedIndex = parseInt(optionEl.dataset.index);
        const question = entranceQuestions[currentQuizIndex];

        const allOptions = document.querySelectorAll('.quiz-option');
        allOptions.forEach(opt => opt.classList.add('disabled'));

        if (selectedIndex === question.correctIndex) {
            optionEl.classList.add('correct');
            quizScore++;
        } else {
            optionEl.classList.add('incorrect');
            allOptions[question.correctIndex].classList.add('correct');
        }

        document.getElementById('quiz-next-btn').style.display = 'block';
    }

    // RETAKE QUIZ
    if (e.target.closest('#retake-quiz-btn')) {
        e.preventDefault();
        currentQuizIndex = 0;
        quizScore = 0;
        const ui = document.getElementById('quiz-ui');
        if (ui) {
            ui.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span id="quiz-difficulty" style="font-size: 12px; color: var(--accent); font-weight: 800; letter-spacing: 2px; text-transform: uppercase;"></span>
                    <span id="quiz-counter" style="color: var(--text-dim); font-size: 14px; font-weight: 600;"></span>
                </div>
                <h3 id="quiz-question" style="font-size: 1.2rem; margin-bottom: 25px; line-height: 1.5; font-weight: 600;"></h3>
                <div id="quiz-options-grid" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;"></div>
                <button id="quiz-next-btn" class="btn-3d" style="width: 100%; display: none; background: rgba(0,255,136,0.1); color: var(--accent); border-color: var(--accent);">Next Question</button>
            `;
            renderQuizQuestion();
        }
    }
});

function renderQuizQuestion() {
    const q = entranceQuestions[currentQuizIndex];
    document.getElementById('quiz-difficulty').textContent = `[${q.difficulty}]`;
    document.getElementById('quiz-counter').textContent = `${currentQuizIndex + 1} / ${entranceQuestions.length}`;
    document.getElementById('quiz-question').textContent = q.question;

    const grid = document.getElementById('quiz-options-grid');
    grid.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.dataset.index = idx;
        div.textContent = opt;
        grid.appendChild(div);
    });

    document.getElementById('quiz-next-btn').style.display = 'none';
}

function finishQuiz() {
    if (quizScore >= 5) {
        localStorage.setItem('testPassed', 'true');
        localStorage.setItem('testScore', quizScore.toString());
        if (typeof window.updateTestUI === 'function') window.updateTestUI();
    } else {
        localStorage.removeItem('testPassed');
        localStorage.removeItem('testScore');
        const ui = document.getElementById('quiz-ui');
        ui.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i data-lucide="x-circle" style="color: #ff3366; width: 64px; height: 64px; margin-bottom: 20px;"></i>
                <h3 style="color: #ff3366; margin-bottom: 15px; font-size: 24px;">Test Failed</h3>
                <p style="color: var(--text-dim); margin-bottom: 30px; font-size: 16px;">
                    You scored ${quizScore} / 10. A minimum of 5 is required to register.
                </p>
                <button id="retake-quiz-btn" class="btn-3d btn-3d-large" style="width: 100%; background: rgba(255,51,102,0.1); border-color: #ff3366; color: #ff3366;">Retake Quiz</button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
